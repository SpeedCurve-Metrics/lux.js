describe("LUX auto with custom label", () => {
  test("using a custom page label", async () => {
    await navigateTo("http://localhost:3000/default-with-label.html");
    const luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    const beacon = new URL(luxRequests[0].url());

    expect(beacon.searchParams.get("l")).toBe("Custom Label");
  });
});
