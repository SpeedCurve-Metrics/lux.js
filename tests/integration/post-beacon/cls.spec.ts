import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { entryTypeSupported } from "../../helpers/browsers";
import { getNavigationTimingMs } from "../../helpers/lux";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon CLS", () => {
  test("CLS is measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/layout-shifts.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const layoutShiftsSupported = await entryTypeSupported(page, "layout-shift");

    if (layoutShiftsSupported) {
      const responseEnd = await getNavigationTimingMs(page, "responseEnd");
      expect(b.cls!.value).toBeGreaterThan(0);
      expect(b.cls!.startTime).toBeGreaterThanOrEqual(responseEnd);
    } else {
      expect(b.cls).toBeUndefined();
    }
  });

  test("CLS is reset between SPA page transitions", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/layout-shifts.html?noShiftDelay&injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const layoutShiftsSupported = await entryTypeSupported(page, "layout-shift");

    if (layoutShiftsSupported) {
      const responseEnd = await getNavigationTimingMs(page, "responseEnd");
      expect(b.cls!.value).toBeGreaterThan(0);
      expect(b.cls!.startTime).toBeGreaterThanOrEqual(responseEnd);
    } else {
      expect(b.cls).toBeUndefined();
    }

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.cls).toBeUndefined();
  });
});
