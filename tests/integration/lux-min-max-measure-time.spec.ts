import { test, expect } from "@playwright/test";
import Flags from "../../src/flags";
import { hasFlag, getElapsedMs, getNavTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX minimum and maximum measure times", () => {
  test("LUX.minMeasureTime is the minimum time before the beacon is sent", async ({ page }) => {
    await page.goto("/default.html?injectScript=LUX.minMeasureTime=300;", {
      waitUntil: "networkidle",
    });

    const beaconTiming: PerformanceNavigationTiming = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => r.name.search(/\/beacon\//) > -1)
        .map((r) => r.toJSON())
        .pop()
    );

    expect(beaconTiming.startTime).toBeGreaterThan(300);
  });

  test("LUX.minMeasureTime is ignored when LUX.send() is called", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.minMeasureTime=300;setTimeout(LUX.send, 100);",
      { waitUntil: "networkidle" }
    );

    const beacon = luxRequests.getUrl(0)!;
    const loadEventStart = getNavTiming(beacon, "ls")!;
    const beaconTiming: PerformanceNavigationTiming = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => r.name.search(/\/beacon\//) > -1)
        .map((r) => r.toJSON())
        .pop()
    );

    expect(beaconTiming.startTime).toBeGreaterThanOrEqual(loadEventStart);
    expect(beaconTiming.startTime).toBeLessThan(300);
  });

  test("the beacon will be sent after LUX.maxMeasureTime in a SPA", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;LUX.maxMeasureTime=200;", {
      waitUntil: "networkidle",
    });

    const secondBeaconStartTime = await getElapsedMs(page);
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(50);
    await page.evaluate(() => LUX.send());

    const thirdBeaconStartTime = await getElapsedMs(page);
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(220);

    const beaconTiming: PerformanceNavigationTiming[] = await page.evaluate(() =>
      performance
        .getEntriesByType("resource")
        .filter((r) => r.name.search(/\/beacon\//) > -1)
        .map((r) => r.toJSON())
    );

    expect(beaconTiming.length).toEqual(3);

    // The first beacon was sent automatically after the maxMeasureTime (200 ms)
    expect(hasFlag(luxRequests.getUrl(0)!, Flags.BeaconSentAfterTimeout))!.toBe(true);
    expect(beaconTiming[0].startTime).toBeGreaterThan(200);
    expect(beaconTiming[0].startTime).toBeLessThan(220);

    // The second beacon was sent manually after a roughly 50 ms wait
    expect(hasFlag(luxRequests.getUrl(1)!, Flags.BeaconSentAfterTimeout))!.toBe(false);
    expect(beaconTiming[1].startTime).toBeGreaterThan(secondBeaconStartTime + 50);
    expect(beaconTiming[1].startTime).toBeLessThan(secondBeaconStartTime + 70);

    // The third beacon was sent automatically
    expect(hasFlag(luxRequests.getUrl(2)!, Flags.BeaconSentAfterTimeout))!.toBe(true);
    expect(beaconTiming[2].startTime).toBeGreaterThan(thirdBeaconStartTime + 200);
    expect(beaconTiming[2].startTime).toBeLessThan(thirdBeaconStartTime + 220);
  });
});
