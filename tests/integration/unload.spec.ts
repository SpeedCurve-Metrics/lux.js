import { test, expect } from "@playwright/test";
import Flags from "../../src/flags";
import { hasFlag } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";
import { setPageHidden } from "../helpers/browsers";

test.describe("LUX unload behaviour", () => {
  test("not automatically sending a beacon when the user navigates away from a page with LUX.auto = false", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    expect(luxRequests.count()).toEqual(0);

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    expect(luxRequests.count()).toEqual(0);
  });

  test("automatically sending a beacon when the user navigates away from the page", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto("/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;", {
      waitUntil: "networkidle",
    });
    expect(luxRequests.count()).toEqual(0);

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    expect(luxRequests.count()).toEqual(1);

    const beacon = luxRequests.getUrl(0)!;
    expect(hasFlag(beacon, Flags.BeaconSentFromUnloadHandler)).toBe(true);
    expect(beacon.searchParams.get("l")).toEqual("LUX default test page");
  });

  test("automatically sending a beacon when the pagehide event fires", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto("/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;", {
      waitUntil: "networkidle",
    });
    expect(luxRequests.count()).toEqual(0);

    await luxRequests.waitForMatchingRequest(() => setPageHidden(page, true));
    expect(luxRequests.count()).toEqual(1);
    expect(hasFlag(luxRequests.getUrl(0)!, Flags.BeaconSentFromUnloadHandler))!.toBe(true);
  });

  test("send a beacon when the pagehide event fires even if minMeasureTime has not elapsed", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;LUX.minMeasureTime=60000",
    );

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => document.dispatchEvent(new Event("pagehide"))),
    );
    expect(luxRequests.count()).toEqual(1);
    expect(hasFlag(luxRequests.getUrl(0)!, Flags.BeaconSentFromUnloadHandler))!.toBe(true);
  });

  test("automatically sending a beacon when the beforeunload event fires", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    // Delete the onpagehide property to trick lux.js into using the beforeunload event
    await page.addInitScript("delete window.onpagehide");
    await page.goto("/default.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;", {
      waitUntil: "networkidle",
    });
    expect(luxRequests.count()).toEqual(0);

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => document.dispatchEvent(new Event("beforeunload"))),
    );
    expect(luxRequests.count()).toEqual(1);
    expect(hasFlag(luxRequests.getUrl(0)!, Flags.BeaconSentFromUnloadHandler))!.toBe(true);
  });
});
