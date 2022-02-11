describe("LUX layout shifts", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  test("CLS is measured", async () => {
    await navigateTo("/layout-shifts.html");

    const beacon = luxRequests.getUrl(0);

    expect(parseFloat(beacon.searchParams.get("CLS"))).toBeGreaterThan(0);
  });
});
