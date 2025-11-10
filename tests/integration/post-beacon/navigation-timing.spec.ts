import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon navigation timing", () => {
  test("Navigation timing is measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const nt = b.nt!;

    expect(nt.activationStart).toEqual(0);
    expect(nt.connectEnd).toBeGreaterThan(0);
    expect(nt.connectStart).toBeGreaterThan(0);
    expect(nt.decodedBodySize).toBeGreaterThan(0);
    expect(nt.domainLookupEnd).toBeGreaterThan(0);
    expect(nt.domainLookupStart).toBeGreaterThan(0);
    expect(nt.domComplete).toBeGreaterThan(0);
    expect(nt.domContentLoadedEventEnd).toBeGreaterThan(0);
    expect(nt.domContentLoadedEventStart).toBeGreaterThan(0);
    expect(nt.domInteractive).toBeGreaterThan(0);
    expect(nt.encodedBodySize).toBeGreaterThan(0);
    expect(nt.fetchStart).toBeGreaterThanOrEqual(0);
    expect(nt.loadEventEnd).toBeGreaterThan(0);
    expect(nt.loadEventStart).toBeGreaterThan(0);
    expect(nt.redirectCount).toEqual(0);
    expect(nt.redirectEnd).toEqual(0);
    expect(nt.redirectStart).toEqual(0);
    expect(nt.requestStart).toBeGreaterThan(0);
    expect(nt.responseEnd).toBeGreaterThan(0);
    expect(nt.responseStart).toBeGreaterThan(0);
    expect(nt.secureConnectionStart).toEqual(0);
    expect(nt.transferSize).toBeGreaterThan(0);
  });

  test("Navigation timing is only measured for the first SPA beacon", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    expect(b.nt).toBeDefined();

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.nt).toBeUndefined();
  });
});
