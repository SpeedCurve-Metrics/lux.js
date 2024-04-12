import { test, expect } from "@playwright/test";
import { getSearchParam, parseNestedPairs } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX tracking integration", () => {
  test("UTM query params are picked up as custom data", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?utm_source=TheSource&utm_campaign=CampaignName");
    await luxRequests.waitForMatchingRequest();

    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["_utm_source"]).toEqual("TheSource");
    expect(customData["_utm_campaign"]).toEqual("CampaignName");
  });

  test("UTM query params do not override existing custom data", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?utm_source=TheSource&utm_campaign=CampaignName&injectScript=LUX.addData('utm_campaign', 'CustomCampaign');",
    );
    await luxRequests.waitForMatchingRequest();

    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["_utm_source"]).toEqual("TheSource");
    expect(customData["_utm_campaign"]).toEqual("CampaignName");
    expect(customData["utm_campaign"]).toEqual("CustomCampaign");
  });
});
