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
    expect(NT.fs).toBeGreaterThanOrEqual(0);
    expect(NT.ds).toBeGreaterThanOrEqual(0);
    expect(NT.de).toBeGreaterThanOrEqual(0);
    expect(NT.cs).toBeGreaterThanOrEqual(0);
    expect(NT.ce).toBeGreaterThanOrEqual(0);
    expect(NT.qs).toBeGreaterThanOrEqual(0);
    expect(NT.oi).toBeGreaterThan(0);
    expect(NT.os).toBeGreaterThan(0);
    expect(NT.oe).toBeGreaterThan(0);
    expect(NT.fc).toBeGreaterThan(0);

    // However some metrics will not be measured, since the beacon is sent before the DOM is loaded
    expect(NT.oc).toBeUndefined();
    expect(NT.ls).toBeUndefined();
    expect(NT.le).toBeUndefined();
  });

  test("when user navigation sends the beacon before onload", async ({ page, browserName }) => {
    test.skip(
      browserName === "webkit",
      "webkit doesn't send beacons on unload unless onload has fired (?!)"
    );

    // The request interceptor will only catch the beacon for the final page view, since requests
    // sent from the unload handler can't be intercepted. This test uses the beacon store to capture
    // the beacon for the first page view.
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/delayed-onload.html?injectScript=setTimeout(() => document.querySelector('a').click(), 200)"
    );
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const NT = getNavTiming(beacon);

    // Most metric assertions should be the same as in Shared.testNavigationTiming
    expect(NT.fs).toBeGreaterThanOrEqual(0);
    expect(NT.ds).toBeGreaterThanOrEqual(0);
    expect(NT.de).toBeGreaterThanOrEqual(0);
    expect(NT.cs).toBeGreaterThanOrEqual(0);
    expect(NT.ce).toBeGreaterThanOrEqual(0);
    expect(NT.qs).toBeGreaterThanOrEqual(0);
    expect(NT.oi).toBeGreaterThan(0);
    expect(NT.os).toBeGreaterThan(0);
    expect(NT.oe).toBeGreaterThan(0);
    expect(NT.fc).toBeGreaterThan(0);

    // However some metrics will not be measured, since the beacon is sent before the DOM is loaded
    expect(NT.ls).toBeUndefined();
    expect(NT.le).toBeUndefined();

    // The difference between this test and the one above using maxMeasureTime is that the browser
    // seems to use the unload time as the domComplete value
    expect(NT.oc).toBeGreaterThanOrEqual(200);
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
    await luxRequests.waitForMatchingRequest(() => page.goto("/default.html?maxAge=30"));
    await luxRequests.waitForMatchingRequest(() => page.goto("/default.html?maxAge=30"));
    await luxRequests.waitForMatchingRequest(() => page.goto("/default.html?maxAge=30"));
    const beacon = luxRequests.getUrl(2)!;

    Shared.testNavigationTiming({ page, browserName, beacon });
  });

  test("when viewing a page with a redirect", async ({ page }) => {
    const redirectDelay = 50;
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(`/default.html?redirectTo=/default.html&redirectDelay=${redirectDelay}`);
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    const NT = getNavTiming(beacon);
    console.log(NT.rs, NT.re);
    expect(NT.rs).toBeGreaterThanOrEqual(0);
    expect(NT.re).toBeGreaterThanOrEqual(redirectDelay);
  });
});
