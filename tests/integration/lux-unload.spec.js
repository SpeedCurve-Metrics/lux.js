describe("LUX unload behaviour", () => {
  test("not automatically sending a beacon when the user navigates away from a page with LUX.auto = false", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("http://localhost:3000/auto-false.html");
    expect(luxRequests.count()).toEqual(0);

    await navigateTo("http://localhost:3000/auto-false.html");
    expect(luxRequests.count()).toEqual(0);
  });

  test("automatically sending a beacon when the user navigates away from the page", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("http://localhost:3000/auto-false-with-unload.html");
    expect(luxRequests.count()).toEqual(0);

    await navigateTo("http://localhost:3000/auto-false.html");
    expect(luxRequests.count()).toEqual(1);

    const UNLOAD_BEACON_FLAG = 16;
    const beacon = luxRequests.getUrl(0);
    const beaconFlags = parseInt(beacon.searchParams.get("fl"), 10);

    expect(beaconFlags & UNLOAD_BEACON_FLAG).toEqual(UNLOAD_BEACON_FLAG);
    expect(beacon.searchParams.get("l")).toEqual("LUX SPA Test with auto unload");
  });
});
