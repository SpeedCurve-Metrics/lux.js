import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { VERSION } from "../../../src/version";
import { getElapsedMs } from "../../helpers/lux";
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
    await page.goto("/images.html");
    await luxRequests.waitForMatchingRequest();

    expect(luxRequests.count()).toEqual(1);
    expect(luxRequests.get(0)!.method()).toEqual("POST");
  });

  test("beacon metadata is always sent", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html", { waitUntil: "networkidle" });
    await page.goto("/images.html");
    await luxRequests.waitForMatchingRequest();

    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    expect(b.customerId).toEqual("10001");
    expect(b.pageId).toBeTruthy();
    expect(b.sessionId).toBeTruthy();
    expect(b.measureDuration).toBeGreaterThan(0);
    expect(b.scriptVersion).toEqual(VERSION);
    expect(b.startTime).toEqual(0);
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
    expect(b.customerId).toEqual("10001");
    expect(b.pageId).toBeTruthy();
    expect(b.sessionId).toBeTruthy();
    expect(b.measureDuration).toBeGreaterThan(0);
    expect(b.scriptVersion).toEqual(VERSION);
    expect(b.startTime).toBeGreaterThanOrEqual(timeBeforeInit);
  });

  test("the beacon is not sent when LUX.auto is false", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.goto("/images.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });

    expect(luxRequests.count()).toEqual(0);
  });

  test("the beacon can be disabled by setting LUX.enablePostBeacon = false", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html?injectScript=LUX.enablePostBeacon=false;", {
      waitUntil: "networkidle",
    });
    await page.goto("/images.html?injectScript=LUX.enablePostBeacon=false;", {
      waitUntil: "networkidle",
    });

    expect(luxRequests.count()).toEqual(0);
  });
});
