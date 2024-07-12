import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import Flags, { hasFlag } from "../../../src/flags";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon CSP violation handling", () => {
  test("sending the beacon is retried on CSP violations", async ({ page }) => {
    const blockedRequests = new RequestInterceptor(page).createRequestMatcher("/v2/store/");
    const approvedRequests = new RequestInterceptor(page).createRequestMatcher(
      "/csp-approved/store/",
    );
    await page.goto(
      "/images.html?injectScript=LUX.beaconUrlFallback='http://localhost:3000/csp-approved/store/';&csp=connect-src http://localhost:3000/csp-approved/store/",
      { waitUntil: "networkidle" },
    );
    await approvedRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    expect(blockedRequests.count()).toEqual(0);
    expect(approvedRequests.count()).toEqual(1);

    const b = approvedRequests.get(0)!.postDataJSON() as BeaconPayload;

    expect(hasFlag(b.flags, Flags.BeaconBlockedByCsp)).toBe(true);
  });

  test("sending the beacon is not retried for report-only CSP violations", async ({ page }) => {
    const defaultRequests = new RequestInterceptor(page).createRequestMatcher("/v2/store/");
    const fallbackRequests = new RequestInterceptor(page).createRequestMatcher(
      "/csp-approved/store/",
    );
    await page.goto(
      "/images.html?injectScript=LUX.beaconUrlFallback='http://localhost:3000/csp-approved/store/';&csp=connect-src http://localhost:3000/csp-approved/store/&cspReportOnly=1",
      { waitUntil: "networkidle" },
    );
    await defaultRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    // 500ms delay just to ensure the fallback request wasn't made
    await page.waitForTimeout(500);

    expect(defaultRequests.count()).toEqual(1);
    expect(fallbackRequests.count()).toEqual(0);

    const b = defaultRequests.get(0)!.postDataJSON() as BeaconPayload;

    expect(hasFlag(b.flags, Flags.BeaconBlockedByCsp)).toBe(false);
  });
});
