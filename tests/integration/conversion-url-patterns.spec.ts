import { test, expect } from "@playwright/test";
import { BOOLEAN_TRUE } from "../../src/constants";
import { getSearchParam, parseNestedPairs } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("Conversion event URL patterns", () => {
  const conversionUrlPatterns = {
    "order-complete": ["/default.html"],
    "checkout-begin": ["/prerender-*.html"],
    "marketing-campaign-1": ["localhost/prerender-index.html"],
    "marketing-campaign-2": ["*host/default.html"],
  };

  test("custom data is created for each pattern that matches the current URL", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      `/default.html?injectScript=LUX.conversions=${JSON.stringify(conversionUrlPatterns)}`,
      { waitUntil: "networkidle" }
    );
    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["order-complete"]).toEqual(BOOLEAN_TRUE);
    expect(customData["checkout-begin"]).toBeUndefined();
    expect(customData["marketing-campaign-1"]).toBeUndefined();
    expect(customData["marketing-campaign-2"]).toEqual(BOOLEAN_TRUE);
  });

  test("partial matches work as expected", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      `/prerender-page.html?injectScript=LUX.conversions=${JSON.stringify(conversionUrlPatterns)}`,
      { waitUntil: "networkidle" }
    );
    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["order-complete"]).toBeUndefined();
    expect(customData["checkout-begin"]).toEqual(BOOLEAN_TRUE);
    expect(customData["marketing-campaign-1"]).toBeUndefined();
    expect(customData["marketing-campaign-2"]).toBeUndefined();
  });
});
