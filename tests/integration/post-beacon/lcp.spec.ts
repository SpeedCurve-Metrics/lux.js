import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { entryTypeSupported } from "../../helpers/browsers";
import { getNavigationTimingMs } from "../../helpers/lux";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon LCP", () => {
  test("LCP is measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html", { waitUntil: "networkidle" });
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const lcpSupported = await entryTypeSupported(page, "largest-contentful-paint");

    if (lcpSupported) {
      const responseEnd = await getNavigationTimingMs(page, "responseEnd");
      expect(b.lcp!.value).toBeGreaterThanOrEqual(responseEnd);
    } else {
      expect(b.lcp).toBeUndefined();
    }
  });

  test("LCP is reset between SPA page transitions", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const lcpSupported = await entryTypeSupported(page, "largest-contentful-paint");

    if (lcpSupported) {
      const responseEnd = await getNavigationTimingMs(page, "responseEnd");
      expect(b.lcp!.value).toBeGreaterThanOrEqual(responseEnd);
    } else {
      expect(b.lcp).toBeUndefined();
    }

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.lcp).toBeUndefined();
  });
});
