import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon CLS", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Layout shifts are only supported in Chromium",
  );

  test("CLS is measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/layout-shifts.html", { waitUntil: "networkidle" });
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;

    expect(b.cls!.value).toBeGreaterThan(0);
    expect(b.cls!.startTime).toBeGreaterThan(b.navigationTiming!.domInteractive);
  });

  test("CLS is reset between SPA page transitions", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/layout-shifts.html?noShiftDelay&injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    expect(b.cls!.value).toBeGreaterThan(0);
    expect(b.cls!.startTime).toBeGreaterThan(b.navigationTiming!.domInteractive);

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.cls).toBeUndefined();
  });
});
