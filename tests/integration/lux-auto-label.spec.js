describe("LUX auto with custom label", () => {
  test("using a custom page label", async () => {
    await navigateTo("http://localhost:3000/default-with-label.html");
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const beacon = luxRequests.getUrl(0);

    expect(beacon.searchParams.get("l")).toEqual("Custom Label");
  });
});
