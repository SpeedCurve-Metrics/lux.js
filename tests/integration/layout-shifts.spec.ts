import { test, expect } from "@playwright/test";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX layout shifts", () => {
  test("CLS is only sent in the POST beacon", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/layout-shifts.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("CLS")).toBeNull();
  });
});
