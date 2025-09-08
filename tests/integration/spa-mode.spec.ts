import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../src/beacon";
import Flags, { hasFlag } from "../../src/flags";
import { entryTypeSupported } from "../helpers/browsers";
import {
  getElapsedMs,
  getNavigationTimingMs,
  getNavTiming,
  getSearchParam,
  parseUserTiming,
} from "../helpers/lux";
import * as Shared from "../helpers/shared-tests";
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

  test("load time for soft navs is not recorded in SPA mode unless LUX.markLoadTime() is called", async ({
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

  test("LUX.markLoadTime() can override loadEventEnd on a hard navigation", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.spaMode=true;");
    await page.evaluate(() => LUX.markLoadTime(12345));
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send(true)));

    const beacon = luxRequests.getUrl(0)!;
    const pageLoadEventStart = await getNavigationTimingMs(page, "loadEventStart");
    const loadEventStart = getNavTiming(beacon, "ls");
    const loadEventEnd = getNavTiming(beacon, "le");

    expect(loadEventStart).toEqual(pageLoadEventStart);
    expect(loadEventEnd).toEqual(12345);
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

  test("legacy implementations work as expected", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    // Simulate loading lux.js with SPA mode injected by the server, and the implementor setting
    // LUX.auto = false.
    await page.goto("/default.html?injectScript=LUX.spaMode=true;LUX.auto=false;", {
      waitUntil: "networkidle",
    });

    await page.evaluate(() => {
      LUX.label = "page-01";
      performance.mark("load-marker", { startTime: 20 });

      // Make an invalid LUX.init call during the hard navigation to test that this is still
      // handled correctly.
      LUX.init();

      // This will be used as the load time but the beacon will not be sent here
      LUX.send();

      LUX.init();
      LUX.label = "page-02";

      setTimeout(() => {
        performance.mark("load-marker");
        LUX.send();
        LUX.init();
        LUX.label = "page-03";

        setTimeout(() => {
          performance.mark("load-marker");
        }, 20);
      }, 20);
    });

    // Wait for the timeouts
    await page.waitForTimeout(80);

    // Abandon the page before LUX.send is called for the third page load.
    await page.goto("/");
    await luxRequests.waitForMatchingRequest();

    expect(luxRequests.count()).toEqual(3);

    const beacon1 = luxRequests.getUrl(0)!;
    const beacon2 = luxRequests.getUrl(1)!;
    const beacon3 = luxRequests.getUrl(2)!;
    const pageLoadEventEnd = await getNavigationTimingMs(page, "loadEventEnd");

    expect(getSearchParam(beacon1, "l")).toEqual("page-01");
    expect(getSearchParam(beacon2, "l")).toEqual("page-02");
    expect(getSearchParam(beacon3, "l")).toEqual("page-03");

    const UT1 = parseUserTiming(getSearchParam(beacon1, "UT"));
    const UT2 = parseUserTiming(getSearchParam(beacon2, "UT"));
    const UT3 = parseUserTiming(getSearchParam(beacon3, "UT"));

    expect(UT1["load-marker"].startTime).toEqual(20);
    expect(UT2["load-marker"].startTime).toBeBetween(20, 30);
    expect(UT3["load-marker"].startTime).toBeBetween(20, 30);

    expect(getNavTiming(beacon1, "le")).toBeGreaterThanOrEqual(pageLoadEventEnd);
  });

  test("MPAs still work as expected", async ({ page, browserName }) => {
    const requestInterceptor = new RequestInterceptor(page);
    const getBeacons = requestInterceptor.createRequestMatcher("/beacon/");
    const postBeacons = requestInterceptor.createRequestMatcher("/store/");
    await page.goto("/default.html?injectScript=LUX.spaMode=true;", { waitUntil: "networkidle" });
    await page.goto("/");
    const getBeacon = getBeacons.getUrl(0)!;
    const postBeacon = postBeacons.get(0)!.postDataJSON() as BeaconPayload;

    Shared.testPageStats({ page, browserName, beacon: getBeacon });
    Shared.testNavigationTiming({ page, browserName, beacon: getBeacon });
    Shared.testPostBeacon(postBeacon);
  });
});
