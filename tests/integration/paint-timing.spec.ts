import { test, expect } from "@playwright/test";
import { getNavTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX paint timing", () => {
  test("paint times are recorded", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/images.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const NT = getNavTiming(beacon);
    const startRender = NT.startRender;

    expect(startRender).toBeGreaterThan(0);
    expect(NT.firstContentfulPaint).toBeGreaterThanOrEqual(startRender);

    if (browserName === "chromium") {
      // LCP is only supported in Chromium
      expect(NT.largestContentfulPaint).toBeGreaterThanOrEqual(startRender);
    } else {
      expect(NT.largestContentfulPaint).toBeUndefined();
    }
  });
});
