import { test, expect } from "@playwright/test";
import Flags, { hasFlag } from "../../src/flags";
import { entryTypeSupported } from "../helpers/browsers";
import { getElapsedMs, getNavTiming, getSearchParam } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX SPA Mode", () => {
  test("beacons are only sent before page transitions and before pagehide", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.spaMode=true;");
    await page.evaluate(() => LUX.send());

    // Calling LUX.send() doesn't trigger a beacon
    expect(luxRequests.count()).toEqual(0);

    // Calling LUX.init() to start a page transition should send the previous beacon
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.init()));
    expect(luxRequests.count()).toEqual(1);

    // Calling LUX.startSoftNavigation() to start a page transition should send the previous beacon
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.startSoftNavigation()));
    expect(luxRequests.count()).toEqual(2);
  });

  test("load time for soft navs is not recorded in SPA mode unless markLoadTime is called", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.spaMode=true;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send(true)));

    // Create a soft nav but don't call LUX.markLoadTime()
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(50);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send(true)));

    let beacon = luxRequests.getUrl(1)!;
    let beaconFlags = parseInt(getSearchParam(beacon, "fl"));
    let loadEventStart = getNavTiming(beacon, "ls");
    let loadEventEnd = getNavTiming(beacon, "le");

    expect(loadEventStart).toBeNull();
    expect(loadEventEnd).toBeNull();
    expect(hasFlag(beaconFlags, Flags.InitCalled)).toBe(true);

    // Create a soft nav and do call LUX.markLoadTime()
    const timeBeforeInit = await page.evaluate(() => {
      const beforeInit = Math.floor(performance.now());
      LUX.init();
      return beforeInit;
    });
    await page.waitForTimeout(50);
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.markLoadTime();
        LUX.send(true);
      }),
    );
    const timeAfterSend = await getElapsedMs(page);

    beacon = luxRequests.getUrl(2)!;
    beaconFlags = parseInt(getSearchParam(beacon, "fl"));
    loadEventStart = getNavTiming(beacon, "ls");
    loadEventEnd = getNavTiming(beacon, "le");

    // We called LUX.markLoadTime() after 50ms
    expect(loadEventStart).toBeGreaterThanOrEqual(50);
    expect(loadEventStart).toBeLessThanOrEqual(timeAfterSend - timeBeforeInit);
    expect(loadEventStart).toEqual(loadEventEnd);
    expect(hasFlag(beaconFlags, Flags.InitCalled)).toBe(true);
  });

  test("LUX.init cannot be accidentally called on the initial navigation in SPA mode", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.spaMode=true;", { waitUntil: "networkidle" });
    await page.evaluate(() => LUX.init());
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send(true)));

    const beacon = luxRequests.getUrl(0)!;
    const NT = getNavTiming(beacon);
    const lcpSupported = await entryTypeSupported(page, "largest-contentful-paint");

    expect(NT.startRender).toBeGreaterThan(0);
    expect(NT.firstContentfulPaint).toBeGreaterThan(0);

    if (lcpSupported) {
      expect(NT.largestContentfulPaint).toBeGreaterThanOrEqual(0);
    } else {
      expect(NT.largestContentfulPaint).toBeUndefined();
    }
  });

  test("legacy implementations work as expected", async () => {});
});
