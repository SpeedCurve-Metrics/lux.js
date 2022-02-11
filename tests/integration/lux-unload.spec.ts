import Flags, { hasFlag } from "../../src/flags";

describe("LUX unload behaviour", () => {
  test("not automatically sending a beacon when the user navigates away from a page with LUX.auto = false", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("http://localhost:3000/default.html?injectScript=LUX.auto=false;");
    expect(luxRequests.count()).toEqual(0);

    await navigateTo("http://localhost:3000/default.html?injectScript=LUX.auto=false;");
    expect(luxRequests.count()).toEqual(0);
  });

  test("automatically sending a beacon when the user navigates away from the page", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo(
      "http://localhost:3000/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;"
    );
    expect(luxRequests.count()).toEqual(0);

    await navigateTo("http://localhost:3000/default.html?injectScript=LUX.auto=false;");
    expect(luxRequests.count()).toEqual(1);

    const beacon = luxRequests.getUrl(0);
    const beaconFlags = parseInt(beacon.searchParams.get("fl"), 10);

    expect(hasFlag(beaconFlags, Flags.BeaconSentFromUnloadHandler)).toBe(true);
    expect(beacon.searchParams.get("l")).toEqual("LUX default test page");
  });

  test("automatically sending a beacon when the pagehide event fires", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo(
      "http://localhost:3000/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;"
    );
    expect(luxRequests.count()).toEqual(0);

    await page.evaluate("document.dispatchEvent(new Event('pagehide'))");
    expect(luxRequests.count()).toEqual(1);

    const beaconFlags = parseInt(luxRequests.getUrl(0).searchParams.get("fl"), 10);
    expect(hasFlag(beaconFlags, Flags.BeaconSentFromUnloadHandler)).toBe(true);
  });

  test("automatically sending a beacon when the beforeunload event fires", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    // Delete the onpagehide property to trick lux.js into using the beforeunload event
    await page.evaluateOnNewDocument("delete window.onpagehide");
    await navigateTo(
      "http://localhost:3000/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;"
    );
    expect(luxRequests.count()).toEqual(0);

    await page.evaluate("document.dispatchEvent(new Event('beforeunload'))");
    expect(luxRequests.count()).toEqual(1);

    const beaconFlags = parseInt(luxRequests.getUrl(0).searchParams.get("fl"), 10);
    expect(hasFlag(beaconFlags, Flags.BeaconSentFromUnloadHandler)).toBe(true);
  });
});
