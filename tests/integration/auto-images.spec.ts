import { test, expect } from "@playwright/test";
import { getPageStat } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX auto images", () => {
  test("calculating the number of images on the page", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/images.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(getPageStat(beacon, "it")).toEqual(3);
    expect(getPageStat(beacon, "ia")).toEqual(2);
  });
});
