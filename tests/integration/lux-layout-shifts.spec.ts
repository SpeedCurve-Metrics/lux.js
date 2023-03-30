describe("LUX layout shifts", () => {
  test("CLS is measured", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/layout-shifts.html");

    const beacon = luxRequests.getUrl(0);

    expect(parseFloat(beacon.searchParams.get("CLS"))).toBeGreaterThan(0);
  });

  test("CLS is reset between SPA page transitions", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/layout-shifts.html?&injectScript=LUX.auto=false;");
    await waitForNetworkIdle();
    await page.evaluate("LUX.send()");

    let beacon = luxRequests.getUrl(0);
    expect(parseFloat(beacon.searchParams.get("CLS"))).toBeGreaterThan(0);

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(200);
    await page.evaluate("LUX.send()");

    beacon = luxRequests.getUrl(1);
    expect(parseFloat(beacon.searchParams.get("CLS"))).toEqual(0);
  });
});
