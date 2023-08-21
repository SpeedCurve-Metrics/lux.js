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

  test("Updates to LCP are sent in the unload beacon", async ({ page, browserName }) => {
    test.skip(browserName != "chromium", "LCP is only supported in Chromium");

    const IMAGE_DELAY = 1000;
    const hideImgScript = [
      "const s = document.createElement('style');",
      "s.innerHTML = '.initial-image { display: none; }';",
      "document.head.appendChild(s);",
    ].join("");

    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(`/element-timing.html?imageDelay=${IMAGE_DELAY}&injectScript=${hideImgScript}`);
    await luxRequests.waitForMatchingRequest();
    await page.waitForTimeout(IMAGE_DELAY);
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();

    const mainBeacon = luxRequests.getUrl(0)!;
    const unloadBeacon = luxRequests.getUrl(1)!;

    expect(getNavTiming(mainBeacon).largestContentfulPaint).toBeGreaterThan(0);
    expect(getNavTiming(mainBeacon).largestContentfulPaint).toBeLessThan(IMAGE_DELAY);
    expect(parseInt(unloadBeacon.searchParams.get("LCP")!)).toBeGreaterThanOrEqual(IMAGE_DELAY);
  });
});
