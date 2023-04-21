import { test, expect } from "@playwright/test";
import { getNavTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX paint timing", () => {
  test("paint times are recorded", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/images.html", { waitUntil: "networkidle" });
    const beacon = luxRequests.getUrl(0)!;
    const startRender = getNavTiming(beacon, "sr")!;

    expect(startRender).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "fc")).toBeGreaterThanOrEqual(startRender);

    if (browserName === "chromium") {
      expect(getNavTiming(beacon, "lc")).toBeGreaterThanOrEqual(startRender);
    } else {
      expect(beacon.searchParams.get("lc")).toBeNull();
    }
  });
});
