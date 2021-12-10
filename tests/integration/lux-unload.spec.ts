import Flags, { hasFlag } from "../../src/flags";

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

    await navigateTo("http://localhost:3000/auto-false-with-send-beacon-on-page-hidden.html");
    expect(luxRequests.count()).toEqual(0);

    await navigateTo("http://localhost:3000/auto-false.html");
    expect(luxRequests.count()).toEqual(1);

    const beacon = luxRequests.getUrl(0);
    const beaconFlags = parseInt(beacon.searchParams.get("fl"), 10);

    expect(hasFlag(beaconFlags, Flags.BeaconSentFromUnloadHandler)).toBe(true);
    expect(beacon.searchParams.get("l")).toEqual("LUX SPA test with sendBeaconOnPageHidden = true");
  });
});
