import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { entryTypeSupported } from "../../helpers/browsers";
import { getElapsedMs, getNavigationTimingMs } from "../../helpers/lux";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon LCP", () => {
  test("LCP is measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
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
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const lcpSupported = await entryTypeSupported(page, "largest-contentful-paint");

    if (lcpSupported) {
      const responseEnd = await getNavigationTimingMs(page, "responseEnd");
      expect(b.lcp!.value).toBeGreaterThanOrEqual(responseEnd);
    } else {
      expect(b.lcp).toBeUndefined();
    }

    // SPA page with no LCP events
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.lcp).toBeUndefined();

    // SPA page with a new LCP event
    const beforeInit = await getElapsedMs(page);
    await page.evaluate(() => LUX.init());
    const beforeInsert = await getElapsedMs(page);
    await page.evaluate(() => {
      const eve = document.createElement("img");
      eve.src = "/eve.jpg?delay=100";
      eve.className = "new-lcp-image";
      eve.style.width = "500px";
      document.querySelector("p")!.prepend(eve);
    });
    await page.waitForTimeout(150);
    const beforeBeacon = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const insertTime = beforeInsert - beforeInit;
    const beaconTime = beforeBeacon - beforeInit;

    b = luxRequests.get(2)!.postDataJSON() as BeaconPayload;
    expect(b.lcp!.value).toBeBetween(insertTime, beaconTime);
    expect(b.lcp!.attribution!.elementSelector).toEqual("html>body>p>img.new-lcp-image");
  });
});
