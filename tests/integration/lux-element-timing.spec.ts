import { test, expect } from "@playwright/test";
import { getElapsedMs, getSearchParam, parseUserTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX element timing", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Element timing is only supported in Chromium"
  );

  test("element timing is collected in auto mode", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/element-timing.html?injectScript=LUX.minMeasureTime=1000;", {
      waitUntil: "networkidle",
    });
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const ET = parseUserTiming(getSearchParam(beacon, "ET"));

    expect(Object.values(ET).length).toEqual(2);
    expect(ET["red-image"].startTime).toBeGreaterThan(0);
    expect(ET["red-image-delayed"].startTime).toBeGreaterThan(ET["red-image"].startTime);
    expect(ET["red-image-delayed"].startTime).toBeGreaterThan(100);
  });

  test("element timing is collected in a SPA", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.send();
        LUX.init();
      })
    );

    const timeBeforeImage = await getElapsedMs(page);
    await page.waitForTimeout(30);
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.src = "red.png";
      img.elementTiming = "spa-image";
      document.body.appendChild(img);
    });
    await page.waitForLoadState("networkidle");
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        // Delay calling LUX.send() so the element timing has a chance to register
        setTimeout(LUX.send, 50);
      })
    );
    const beacon = luxRequests.getUrl(1)!;
    const ET = parseUserTiming(getSearchParam(beacon, "ET"));

    expect(Object.keys(ET).length).toEqual(1);
    expect(ET["spa-image"].startTime).toBeLessThan(timeBeforeImage);
    expect(ET["spa-image"].startTime).toBeGreaterThan(30);
  });
});
