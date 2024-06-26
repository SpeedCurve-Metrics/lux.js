import { test, expect } from "@playwright/test";
import { entryTypeSupported } from "../helpers/browsers";
import { getSearchParam } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX layout shifts", () => {
  test("CLS is measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/layout-shifts.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const layoutShiftsSupported = await entryTypeSupported(page, "layout-shift");

    if (layoutShiftsSupported) {
      expect(parseFloat(getSearchParam(beacon, "CLS"))).toBeGreaterThan(0);
    } else {
      expect(beacon.searchParams.get("CLS")).toBeNull();
    }
  });

  test("CLS is reset between SPA page transitions", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/layout-shifts.html?noShiftDelay&injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    let beacon = luxRequests.getUrl(0)!;
    const layoutShiftsSupported = await entryTypeSupported(page, "layout-shift");

    if (layoutShiftsSupported) {
      expect(parseFloat(getSearchParam(beacon, "CLS"))).toBeGreaterThan(0);
    } else {
      expect(beacon.searchParams.get("CLS")).toBeNull();
    }

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    beacon = luxRequests.getUrl(1)!;

    if (layoutShiftsSupported) {
      expect(parseFloat(getSearchParam(beacon, "CLS"))).toEqual(0);
    } else {
      expect(beacon.searchParams.get("CLS")).toBeNull();
    }
  });
});
