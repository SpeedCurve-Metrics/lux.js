import { test, expect } from "@playwright/test";
import { getSearchParam } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX layout shifts", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Layout shifts are only supported in Chromium"
  );

  test("CLS is measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/layout-shifts.html", { waitUntil: "networkidle" });

    const beacon = luxRequests.getUrl(0)!;
    expect(parseFloat(getSearchParam(beacon, "CLS"))).toBeGreaterThan(0);
  });

  test("CLS is reset between SPA page transitions", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/layout-shifts.html?&injectScript=LUX.auto=false;", {
      waitUntil: "networkidle",
    });
    await page.waitForLoadState("networkidle");
    await page.evaluate(() => LUX.send());

    let beacon = luxRequests.getUrl(0)!;
    expect(parseFloat(getSearchParam(beacon, "CLS"))).toBeGreaterThan(0);

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await page.evaluate(() => LUX.send());

    beacon = luxRequests.getUrl(1)!;
    expect(parseFloat(getSearchParam(beacon, "CLS"))).toEqual(0);
  });
});
