import { getElapsedMs, parseUserTiming } from "../helpers/lux";

describe("LUX element timing", () => {
  test("element timing is collected in auto mode", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/element-timing.html?injectScript=LUX.minMeasureTime=1000;");
    await page.waitForNetworkIdle();
    const beacon = luxRequests.getUrl(0);
    const ET = parseUserTiming(beacon.searchParams.get("ET"));

    expect(Object.values(ET).length).toEqual(2);
    expect(ET["red-image"].startTime).toBeGreaterThan(0);
    expect(ET["red-image-delayed"].startTime).toBeGreaterThan(ET["red-image"].startTime);
    expect(ET["red-image-delayed"].startTime).toBeGreaterThan(100);
  });

  test("element timing is collected in a SPA", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    await waitForNetworkIdle();
    await page.evaluate(() => {
      LUX.send();
      LUX.init();
    });

    const timeBeforeImage = await getElapsedMs(page);
    await page.waitForTimeout(30);
    await page.evaluate(() => {
      const img = document.createElement("img");
      img.src = "red.png";
      img.elementTiming = "spa-image";
      document.body.appendChild(img);
    });

    await waitForNetworkIdle();
    await page.evaluate("LUX.send()");
    const beacon = luxRequests.getUrl(1);
    const ET = parseUserTiming(beacon.searchParams.get("ET"));

    expect(Object.keys(ET).length).toEqual(1);
    expect(ET["spa-image"].startTime).toBeLessThan(timeBeforeImage);
    expect(ET["spa-image"].startTime).toBeGreaterThan(30);
  });
});
