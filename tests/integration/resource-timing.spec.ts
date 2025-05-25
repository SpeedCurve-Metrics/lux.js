import { test, expect } from "@playwright/test";
import { getPageStat } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX beacon sample rate", () => {
  test("resource timing metrics are gathered", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto("/render-blocking-resources.html", {
      waitUntil: "networkidle",
    });

    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const supportsRenderBlocking = await page.evaluate(
      () => "renderBlockingStatus" in performance.getEntriesByType("resource")[0],
    );

    expect(getPageStat(beacon, "ns")).toEqual(3);
    expect(getPageStat(beacon, "ss")).toEqual(2);

    if (supportsRenderBlocking) {
      expect(getPageStat(beacon, "bs")).toEqual(1);
      expect(getPageStat(beacon, "bc")).toEqual(1);
    } else {
      expect(getPageStat(beacon, "bs")).toBeNull();
      expect(getPageStat(beacon, "bc")).toBeNull();
    }
  });
});
