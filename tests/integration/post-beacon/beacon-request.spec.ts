import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { getElapsedMs } from "../../helpers/lux";
import * as Shared from "../../helpers/shared-tests";
import RequestInterceptor from "../../request-interceptor";

/**
 * These tests use /images.html since at the time of writing, the POST beacon is only sent when it
 * contains valid metric data. The images.html page is likely to contain CLS and LCP data, so the
 * beacon will be sent.
 */
test.describe("POST beacon request", () => {
  test("beacon is sent with a POST request", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));

    expect(luxRequests.count()).toEqual(1);
    expect(luxRequests.get(0)!.method()).toEqual("POST");
  });

  test("beacon metadata is always sent", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));

    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    expect(b.startTime).toEqual(0);
    Shared.testPostBeacon(b);
  });

  test("beacon metadata works when the lux.js script is loaded before the snippet", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html?noInlineSnippet", { waitUntil: "networkidle" });
    await page.addScriptTag({ url: "/js/snippet.js" });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));

    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    expect(b.startTime).toEqual(0);
    Shared.testPostBeacon(b);
  });

  test("beacon metadata works when there is no snippet", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html?noInlineSnippet", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));

    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    expect(b.startTime).toEqual(0);
    Shared.testPostBeacon(b, false);
  });

  test("beacon metadata is sent for SPAs", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html?injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    expect(luxRequests.count()).toEqual(1);

    const timeBeforeInit = await getElapsedMs(page);
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    expect(luxRequests.count()).toEqual(2);

    const b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.startTime).toBeGreaterThanOrEqual(timeBeforeInit);
    Shared.testPostBeacon(b);
  });

  test("the beacon is not sent when LUX.auto is false", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.goto("/images.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });

    expect(luxRequests.count()).toEqual(0);
  });

  test("the beacon is sent when LUX.auto is false and LUX.sendBeaconOnPageHidden is true", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html?injectScript=LUX.auto=false;LUX.sendBeaconOnPageHidden=true;", {
      waitUntil: "networkidle",
    });
    await page.goto("/images.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest();

    expect(luxRequests.count()).toEqual(1);
  });
});
