import { test, expect } from "@playwright/test";
import Flags, { hasFlag } from "../../src/flags";
import { getNavTiming, getPageStat, getPerformanceTimingMs, getSearchParam } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX SPA", () => {
  test("sending a LUX beacon only when LUX.send is called", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    expect(luxRequests.count()).toEqual(0);

    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    expect(luxRequests.count()).toEqual(1);
  });

  test("regular page metrics are sent for the first SPA page view", async ({
    page,
    browserName,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(0)!;

    // Paint metrics
    expect(getNavTiming(beacon, "sr")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "fc")).toBeGreaterThan(0);

    if (browserName === "chromium") {
      expect(getNavTiming(beacon, "lc")).toBeGreaterThanOrEqual(0);
    } else {
      expect(beacon.searchParams.get("lc")).toBeNull();
    }

    // Page stats
    expect(getPageStat(beacon, "ns")).toEqual(1);
    expect(getPageStat(beacon, "ss")).toEqual(0);

    // Viewport stats
    const viewport = page.viewportSize()!;
    expect(getPageStat(beacon, "vh")).toEqual(viewport.height);
    expect(getPageStat(beacon, "vw")).toEqual(viewport.width);
  });

  test("calling LUX.init before LUX.send does not lose data", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate(() => LUX.init());
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(0)!;

    expect(getNavTiming(beacon, "sr")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "fc")).toBeGreaterThan(0);

    if (browserName === "chromium") {
      expect(getNavTiming(beacon, "lc")).toBeGreaterThanOrEqual(0);
    } else {
      expect(beacon.searchParams.get("lc")).toBeNull();
    }
  });

  test("load time value for the first pages is the time between navigationStart and loadEventStart", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const beacon = luxRequests.getUrl(0)!;
    const luxLoadEventStart = getNavTiming(beacon, "ls");
    const luxLoadEventEnd = getNavTiming(beacon, "ls");
    const pageLoadEventStart = await getPerformanceTimingMs(page, "loadEventStart");
    const pageLoadEventEnd = await getPerformanceTimingMs(page, "loadEventEnd");

    expect(luxLoadEventStart).toEqual(pageLoadEventStart);
    expect(luxLoadEventEnd).toEqual(pageLoadEventEnd);
  });

  test("load time value for subsequent pages is the time between LUX.init() and LUX.send()", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(50);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(1)!;
    const loadEventStart = getNavTiming(beacon, "ls");
    const loadEventEnd = getNavTiming(beacon, "le");

    // We waited 50ms between LUX.init() and LUX.send(), so the load time should
    // be at least 50ms. 60ms is an arbitrary upper limit to make sure we're not
    // over-reporting load time.
    expect(loadEventStart).toBeGreaterThanOrEqual(20);
    expect(loadEventStart).toBeLessThan(60);
    expect(loadEventStart).toEqual(loadEventEnd);

    // Check that the InitCalled flag was set
    const beaconFlags = parseInt(getSearchParam(beacon, "fl"));

    expect(hasFlag(beaconFlags, Flags.InitCalled)).toBe(true);
  });

  test("load time can be marked before the beacon is sent", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(10);
    await page.evaluate(() => LUX.markLoadTime());
    await page.waitForTimeout(50);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(1)!;
    const loadEventStart = getNavTiming(beacon, "le");

    expect(loadEventStart).toBeGreaterThanOrEqual(10);
    expect(loadEventStart).toBeLessThan(50);
  });
});
