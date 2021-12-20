describe("LUX layout shifts", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  test("CLS is measured", async () => {
    await navigateTo("http://localhost:3000/default-with-layout-shift.html");

    const beacon = luxRequests.getUrl(0);

    expect(parseFloat(beacon.searchParams.get("CLS"))).toBeGreaterThan(0);
  });
});
