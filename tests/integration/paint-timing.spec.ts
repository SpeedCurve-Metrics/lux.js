import { test, expect } from "@playwright/test";
import { entryTypeSupported } from "../helpers/browsers";
import { getNavTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX paint timing", () => {
  test("paint times are recorded", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/images.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const NT = getNavTiming(beacon);
    const startRender = NT.startRender;

    expect(startRender).toBeGreaterThan(0);
    expect(NT.firstContentfulPaint).toBeGreaterThanOrEqual(startRender);

    const lcpSupported = await entryTypeSupported(page, "largest-contentful-paint");

    if (lcpSupported) {
      expect(NT.largestContentfulPaint).toBeGreaterThanOrEqual(startRender);
    } else {
      expect(NT.largestContentfulPaint).toBeUndefined();
    }
  });
});
