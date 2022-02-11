import Flags from "../../src/flags";
import { hasFlag } from "../helpers/lux";

describe("LUX unload behaviour", () => {
  test("not automatically sending a beacon when the user navigates away from a page with LUX.auto = false", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    expect(luxRequests.count()).toEqual(0);

    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    expect(luxRequests.count()).toEqual(0);
  });

  test("automatically sending a beacon when the user navigates away from the page", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;");
    expect(luxRequests.count()).toEqual(0);

    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    expect(luxRequests.count()).toEqual(1);

    const beacon = luxRequests.getUrl(0);

    expect(hasFlag(beacon, Flags.BeaconSentFromUnloadHandler)).toBe(true);
    expect(beacon.searchParams.get("l")).toEqual("LUX default test page");
  });

  test("automatically sending a beacon when the pagehide event fires", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;");
    expect(luxRequests.count()).toEqual(0);

    await page.evaluate("document.dispatchEvent(new Event('pagehide'))");
    expect(luxRequests.count()).toEqual(1);

    expect(hasFlag(luxRequests.getUrl(0), Flags.BeaconSentFromUnloadHandler)).toBe(true);
  });

  test("automatically sending a beacon when the beforeunload event fires", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    // Delete the onpagehide property to trick lux.js into using the beforeunload event
    await page.evaluateOnNewDocument("delete window.onpagehide");
    await navigateTo("/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;");
    expect(luxRequests.count()).toEqual(0);

    await page.evaluate("document.dispatchEvent(new Event('beforeunload'))");
    expect(luxRequests.count()).toEqual(1);

    expect(hasFlag(luxRequests.getUrl(0), Flags.BeaconSentFromUnloadHandler)).toBe(true);
  });
});
