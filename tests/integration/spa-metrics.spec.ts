import { test, expect } from "@playwright/test";
import Flags, { hasFlag } from "../../src/flags";
import { getElapsedMs, getNavTiming, getNavigationTimingMs, getSearchParam } from "../helpers/lux";
import * as Shared from "../helpers/shared-tests";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX SPA", () => {
  test("sending a LUX beacon only when LUX.send is called", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    expect(luxRequests.count()).toEqual(0);

    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    expect(luxRequests.count()).toEqual(1);
  });

  test("regular page metrics are sent for the initial document load in a SPA", async ({
    page,
    browserName,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const beacon = luxRequests.getUrl(0)!;

    Shared.testPageStats({ page, browserName, beacon });
    Shared.testNavigationTiming({ page, browserName, beacon });
  });

  test("regular page metrics are sent for subsequent page views in a SPA", async ({
    page,
    browserName,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.send();
        LUX.init();
      }),
    );
    await page.waitForTimeout(50);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const beacon = luxRequests.getUrl(1)!;

    Shared.testPageStats({ page, browserName, beacon });

    const NT = getNavTiming(beacon);

    // fetchStart and activationStart will always be zero
    expect(NT.fetchStart).toEqual(0);
    expect(NT.activationStart).toEqual(0);

    // Load times will be non-zero
    expect(NT.loadEventStart, "loadEventStart should be >0").toBeGreaterThan(0);
    expect(NT.loadEventEnd, "loadEventEnd should be >0").toBeGreaterThan(0);

    // Other metrics should be null in a SPA
    expect(NT.domainLookupStart).toBeUndefined();
    expect(NT.domainLookupEnd).toBeUndefined();
    expect(NT.connectStart).toBeUndefined();
    expect(NT.connectEnd).toBeUndefined();
    expect(NT.requestStart).toBeUndefined();
    expect(NT.responseStart).toBeUndefined();
    expect(NT.responseEnd).toBeUndefined();
    expect(NT.domInteractive).toBeUndefined();
    expect(NT.domContentLoadedEventStart).toBeUndefined();
    expect(NT.domContentLoadedEventEnd).toBeUndefined();
    expect(NT.domComplete).toBeUndefined();
    expect(NT.startRender).toBeUndefined();
    expect(NT.firstContentfulPaint).toBeUndefined();
    expect(NT.largestContentfulPaint).toBeUndefined();
  });

  test("calling LUX.init before LUX.send does not lose data", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate(() => LUX.init());
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(0)!;
    const NT = getNavTiming(beacon);

    expect(NT.firstContentfulPaint).toBeGreaterThan(0);

    if (browserName === "chromium") {
      expect(NT.startRender).toBeGreaterThan(0);
      expect(NT.largestContentfulPaint).toBeGreaterThanOrEqual(0);
    } else {
      expect(NT.largestContentfulPaint).toBeUndefined();
    }
  });

  test("load time value for the first pages is the time between navigationStart and loadEventStart", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const beacon = luxRequests.getUrl(0)!;
    const luxLoadEventStart = getNavTiming(beacon, "ls");
    const luxLoadEventEnd = getNavTiming(beacon, "le");
    const pageLoadEventStart = await getNavigationTimingMs(page, "loadEventStart");
    const pageLoadEventEnd = await getNavigationTimingMs(page, "loadEventEnd");

    expect(luxLoadEventStart).toEqual(pageLoadEventStart);
    expect(luxLoadEventEnd).toEqual(pageLoadEventEnd);
  });

  test("load time value for subsequent pages is the time between LUX.init() and LUX.send()", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const timeBeforeInit = await page.evaluate(() => {
      const beforeInit = Math.floor(performance.now());
      LUX.init();
      return beforeInit;
    });
    await page.waitForTimeout(50);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const timeAfterSend = await getElapsedMs(page);

    const beacon = luxRequests.getUrl(1)!;
    const loadEventStart = getNavTiming(beacon, "ls");
    const loadEventEnd = getNavTiming(beacon, "le");

    // We waited 50ms between LUX.init() and LUX.send(), so the load time should
    // be at least 50ms. 60ms is an arbitrary upper limit to make sure we're not
    // over-reporting load time.
    expect(loadEventStart).toBeGreaterThanOrEqual(50);
    expect(loadEventStart).toBeLessThanOrEqual(timeAfterSend - timeBeforeInit);
    expect(loadEventStart).toEqual(loadEventEnd);

    // Check that the InitCalled flag was set
    const beaconFlags = parseInt(getSearchParam(beacon, "fl"));

    expect(hasFlag(beaconFlags, Flags.InitCalled)).toBe(true);
  });

  test("load time can be marked before the beacon is sent", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;");
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
