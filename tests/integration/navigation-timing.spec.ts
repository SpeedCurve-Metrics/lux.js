import { test, expect } from "@playwright/test";
import { getNavTiming } from "../helpers/lux";
import * as Shared from "../helpers/shared-tests";
import RequestInterceptor from "../request-interceptor";

test.describe("Navigation timing", () => {
  test("in auto mode", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const beforeNav = new Date().getTime();
    await page.goto("/default.html");
    const afterNav = new Date().getTime();
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    // navigationStart should be a timestamp
    expect(parseInt(beacon.searchParams.get("NT")!)).toBeGreaterThanOrEqual(beforeNav);
    expect(parseInt(beacon.searchParams.get("NT")!)).toBeLessThan(afterNav);

    // There should be no redirects for this test page
    expect(getNavTiming(beacon, "rs")).toBeNull();
    expect(getNavTiming(beacon, "re")).toBeNull();

    Shared.testNavigationTiming({ page, browserName, beacon });
  });

  test("when maxMeasureTime sends the beacon before onload", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/delayed-onload.html?injectScript=LUX.maxMeasureTime=200");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const NT = getNavTiming(beacon);

    // Most metric assertions should be the same as in Shared.testNavigationTiming
    expect(NT.fetchStart).toBeGreaterThanOrEqual(0);
    expect(NT.domainLookupStart).toBeGreaterThanOrEqual(0);
    expect(NT.domainLookupEnd).toBeGreaterThanOrEqual(0);
    expect(NT.connectStart).toBeGreaterThanOrEqual(0);
    expect(NT.connectEnd).toBeGreaterThanOrEqual(0);
    expect(NT.requestStart).toBeGreaterThanOrEqual(0);
    expect(NT.domInteractive).toBeGreaterThan(0);
    expect(NT.domContentLoadedEventStart).toBeGreaterThan(0);
    expect(NT.domContentLoadedEventEnd).toBeGreaterThan(0);
    expect(NT.firstContentfulPaint).toBeGreaterThan(0);

    // However some metrics will not be measured, since the beacon is sent before the DOM is loaded
    expect(NT.domComplete).toBeUndefined();
    expect(NT.loadEventStart).toBeUndefined();
    expect(NT.loadEventEnd).toBeUndefined();
  });

  test("when user navigation sends the beacon before onload", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "webkit doesn't send beacons on unload unless onload has fired (?!)",
    );

    // The request interceptor will only catch the beacon for the final page view, since requests
    // sent from the unload handler can't be intercepted. This test uses the beacon store to capture
    // the beacon for the first page view.
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/delayed-onload.html?injectScript=setTimeout(() => document.querySelector('a').click(), 200)",
    );
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const NT = getNavTiming(beacon);

    // Most metric assertions should be the same as in Shared.testNavigationTiming
    expect(NT.fetchStart).toBeGreaterThanOrEqual(0);
    expect(NT.domainLookupStart).toBeGreaterThanOrEqual(0);
    expect(NT.domainLookupEnd).toBeGreaterThanOrEqual(0);
    expect(NT.connectStart).toBeGreaterThanOrEqual(0);
    expect(NT.connectEnd).toBeGreaterThanOrEqual(0);
    expect(NT.requestStart).toBeGreaterThanOrEqual(0);
    expect(NT.domInteractive).toBeGreaterThan(0);
    expect(NT.domContentLoadedEventStart).toBeGreaterThan(0);
    expect(NT.domContentLoadedEventEnd).toBeGreaterThan(0);
    expect(NT.domComplete).toBeGreaterThan(0);
    expect(NT.firstContentfulPaint).toBeGreaterThan(0);

    // However some metrics will not be measured, since the beacon is sent before the DOM is loaded
    expect(NT.loadEventStart).toBeUndefined();
    expect(NT.loadEventEnd).toBeUndefined();

    // The difference between this test and the one above using maxMeasureTime is that the browser
    // seems to use the unload time as the domComplete value
    expect(NT.domComplete).toBeGreaterThanOrEqual(200);
  });

  test("when viewing multiple pages without cache", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await luxRequests.waitForMatchingRequest(() => page.goto("/default.html"));
    await luxRequests.waitForMatchingRequest(() => page.goto("/default.html"));
    await luxRequests.waitForMatchingRequest(() => page.goto("/default.html"));
    const beacon = luxRequests.getUrl(2)!;

    Shared.testNavigationTiming({ page, browserName, beacon });
  });

  test("when viewing multiple pages with cache", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await luxRequests.waitForMatchingRequest(() =>
      page.goto("/default.html?maxAge=30&keepAlive=true"),
    );
    await luxRequests.waitForMatchingRequest(() =>
      page.goto("/default.html?maxAge=30&keepAlive=true"),
    );
    await luxRequests.waitForMatchingRequest(() =>
      page.goto("/default.html?maxAge=30&keepAlive=true"),
    );
    const beacon = luxRequests.getUrl(2)!;
    const NT = getNavTiming(beacon);

    // Technically these should all be zero, but sometimes browsers report them as "nearly zero"
    expect(NT.fetchStart).toBeLessThan(5);
    expect(NT.domainLookupStart).toBeLessThan(5);
    expect(NT.domainLookupEnd).toBeLessThan(5);
    expect(NT.connectStart).toBeLessThan(5);
    expect(NT.connectEnd).toBeLessThan(5);

    Shared.testNavigationTiming({ page, browserName, beacon });
  });

  test("when viewing a page with a redirect", async ({ page }) => {
    const redirectDelay = 50;
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(`/default.html?redirectTo=/default.html&redirectDelay=${redirectDelay}`);
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    const NT = getNavTiming(beacon);

    expect(NT.redirectStart).toBeGreaterThanOrEqual(0);
    expect(NT.redirectEnd).toBeGreaterThanOrEqual(redirectDelay);
  });

  test("when the connection is reused", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await luxRequests.waitForMatchingRequest(() => page.goto("/default.html?keepAlive=true"));
    await luxRequests.waitForMatchingRequest(() => page.goto("/default.html?keepAlive=true"));
    const beacon = luxRequests.getUrl(1)!;

    const NT = getNavTiming(beacon);

    // Technically these should all be zero, but sometimes browsers report them as "nearly zero"
    expect(NT.fetchStart).toBeLessThan(5);
    expect(NT.domainLookupStart).toBeLessThan(5);
    expect(NT.domainLookupEnd).toBeLessThan(5);
    expect(NT.connectStart).toBeLessThan(5);
    expect(NT.connectEnd).toBeLessThan(5);
  });
});
