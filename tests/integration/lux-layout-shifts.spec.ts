describe("LUX layout shifts", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  test("CLS is measured", async () => {
    await navigateTo("/layout-shifts.html");

    const beacon = luxRequests.getUrl(0);

    console.log(parseFloat(beacon.searchParams.get("CLS")));
    expect(parseFloat(beacon.searchParams.get("CLS"))).toBeGreaterThan(0);
  });

  test("CLS is windowed into 5-second sessions", async () => {
    await navigateTo("/layout-shifts.html?injectScript=LUX.auto=false;");

    const beacon = luxRequests.getUrl(0);

    expect(parseFloat(beacon.searchParams.get("CLS"))).toBeGreaterThan(0);
  });
});
