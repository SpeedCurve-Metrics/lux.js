import { test, expect } from "@playwright/test";
import { getElapsedMs, getSearchParam, parseUserTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX element timing", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Element timing is only supported in Chromium",
  );

  test("element timing is collected in auto mode", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/element-timing.html?injectScript=LUX.minMeasureTime=1000;");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const ET = parseUserTiming(getSearchParam(beacon, "ET"));

    expect(Object.values(ET).length).toEqual(2);
    expect(ET["eve-image"].startTime).toBeGreaterThan(0);
    expect(ET["eve-image-delayed"].startTime).toBeGreaterThan(ET["eve-image"].startTime);
    expect(ET["eve-image-delayed"].startTime).toBeGreaterThan(100);
  });

  test("element timing is collected in a SPA", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const imageRequests = new RequestInterceptor(page).createRequestMatcher("eve.jpg\\?delayed");
    await page.goto("/element-timing.html?injectScript=LUX.auto=false;");

    // Wait for the delayed image to load before sending the first beacon
    await imageRequests.waitForMatchingRequest();
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        // Delay calling LUX.send() so the element timing has a chance to register
        setTimeout(LUX.send, 50);
      }),
    );

    // Create another RequestInterceptor to wait for the SPA image
    const spaImageRequests = new RequestInterceptor(page).createRequestMatcher("charlie.jpg");

    // Force a delay and record the timestamp so we can assert the image time was recorded relative
    // to the next LUX.init call
    await page.waitForTimeout(100);
    const timeBeforeImage = await getElapsedMs(page);
    page.evaluate(() => LUX.init());

    await page.waitForTimeout(30);
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.src = "charlie.jpg";
      img.elementTiming = "spa-image";
      document.body.appendChild(img);
    });
    await spaImageRequests.waitForMatchingRequest();
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        // Delay calling LUX.send() so the element timing has a chance to register
        setTimeout(LUX.send, 50);
      }),
    );

    const firstBeacon = luxRequests.getUrl(0)!;
    const secondBeacon = luxRequests.getUrl(1)!;
    const firstET = parseUserTiming(getSearchParam(firstBeacon, "ET"));
    const secondET = parseUserTiming(getSearchParam(secondBeacon, "ET"));

    expect(Object.keys(firstET).length).toEqual(2);
    expect(firstET["eve-image"].startTime).toBeGreaterThan(0);
    expect(firstET["eve-image-delayed"].startTime).toBeGreaterThan(firstET["eve-image"].startTime);

    expect(Object.keys(secondET).length).toEqual(1);
    expect(secondET["spa-image"].startTime).toBeLessThan(timeBeforeImage);
    expect(secondET["spa-image"].startTime).toBeGreaterThan(30);
  });
});
