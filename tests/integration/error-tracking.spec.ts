import { test, expect } from "@playwright/test";
import { referenceErrorMessage, syntaxErrorMessage } from "../helpers/browsers";
import RequestInterceptor from "../request-interceptor";

function allErrors(beacons: { postDataJSON(): { errors?: Array<{ message: string }> } | null }[]) {
  return beacons.flatMap((r) => r.postDataJSON()?.errors ?? []);
}

test.describe("LUX JavaScript error tracking", () => {
  test("sends error beacons with shared page context", async ({ page, browserName }) => {
    const beaconRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/store/error");

    await page.goto("/javascript-errors.html", { waitUntil: "networkidle" });
    await errorRequests.waitForMatchingRequest();

    expect(beaconRequests.count()).toEqual(1);

    const errors = allErrors(errorRequests.requests);
    expect(errors).toHaveLength(2);
    expect(errors[0].message).toContain(referenceErrorMessage(browserName, "foo"));
    expect(errors[1].message).toContain(syntaxErrorMessage(browserName));

    const beacon = errorRequests.get(0)!.postDataJSON();
    expect(beacon.customerId).toBeDefined();
    expect(beacon.pageId).toBeDefined();
    expect(beacon.sessionId).toBeDefined();
    expect(beacon.scriptVersion).toBeDefined();
    expect(beacon.hostname).toEqual("localhost");
    expect(beacon.pathname).toEqual("/javascript-errors.html");
    expect(beacon.pageLabel).toEqual("LUX JavaScript errors test page");

    expect(typeof beacon.flags).toBe("number");
    expect(typeof beacon.customData).toBe("object");
    expect(beacon.customData).not.toBeNull();
    // navigationType, connectionType, deliveryType, deviceMemory are browser-dependent:
    // present-or-absent, but if present, must be of the right type.
    if ("navigationType" in beacon) {
      expect(typeof beacon.navigationType).toBe("number");
    }
    if ("connectionType" in beacon) {
      expect(typeof beacon.connectionType).toBe("string");
    }
    if ("deliveryType" in beacon) {
      expect(typeof beacon.deliveryType).toBe("string");
    }
    if ("deviceMemory" in beacon) {
      expect(typeof beacon.deviceMemory).toBe("number");
    }

    const firstError = beacon.errors[0];
    expect(firstError.errorTime).toBeGreaterThanOrEqual(0);
    expect(firstError.filename).toBeDefined();
    expect(typeof firstError.lineno).toBe("number");
    expect(typeof firstError.colno).toBe("number");
  });

  test("error reporting in a SPA", async ({ page, browserName }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/store/error");

    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => (LUX.label = "SPA Label"));
    await errorRequests.waitForMatchingRequest(() => page.addScriptTag({ content: "foo.bar()" }));

    const beacon = errorRequests.get(0)!.postDataJSON();

    expect(beacon.customerId).toBeDefined();
    expect(beacon.pageId).toBeDefined();
    expect(beacon.sessionId).toBeDefined();
    expect(beacon.pageLabel).toEqual("SPA Label");
    expect(beacon.errors).toHaveLength(1);
    expect(beacon.errors[0].message).toContain(referenceErrorMessage(browserName, "foo"));
  });

  test("errors can be limited", async ({ page }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/store/error");

    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => (LUX.maxErrors = 2));
    await page.addScriptTag({ content: "bar()" });
    await page.addScriptTag({ content: "baz()" });
    await page.addScriptTag({ content: "bam()" });
    await errorRequests.waitForMatchingRequest();

    expect(allErrors(errorRequests.requests)).toHaveLength(2);
  });

  test("max errors are reset for each page view", async ({ page }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/store/error");

    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => (LUX.maxErrors = 2));
    await page.evaluate(() => LUX.send());
    await page.waitForLoadState("networkidle");

    await page.addScriptTag({ content: "bar()" });
    await page.addScriptTag({ content: "baz()" });
    await page.addScriptTag({ content: "bam()" });
    await page.waitForLoadState("networkidle");

    await page.evaluate(() => LUX.init());
    await page.addScriptTag({ content: "bam()" });
    await errorRequests.waitForMatchingRequest(2);

    // 2 errors on the first page + 1 on the second page (after init reset) = 3 total
    expect(allErrors(errorRequests.requests)).toHaveLength(3);
  });

  test("error reporting can be disabled", async ({ page, browserName }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/store/error");

    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => (LUX.trackErrors = false));
    await page.addScriptTag({ content: "foo.bar()" });
    await page.waitForLoadState("networkidle");

    expect(allErrors(errorRequests.requests)).toHaveLength(0);

    await page.evaluate(() => (LUX.trackErrors = true));
    await errorRequests.waitForMatchingRequest(() => page.addScriptTag({ content: "bing.bong()" }));

    const errors = allErrors(errorRequests.requests);
    expect(errors).toHaveLength(1);
    expect(errors[0].message).toContain(referenceErrorMessage(browserName, "bing"));
  });

  test("error beacon carries LUX.addData custom data", async ({ page }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/store/error");

    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => {
      LUX.addData("region", "eu");
      LUX.addData("tier", "pro");
    });
    await errorRequests.waitForMatchingRequest(() => page.addScriptTag({ content: "foo.bar()" }));

    const beacon = errorRequests.get(0)!.postDataJSON();
    expect(beacon.customData).toEqual({ region: "eu", tier: "pro" });
  });
});
