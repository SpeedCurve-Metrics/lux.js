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
    await page.evaluate(() => LUX.send());
    await approvedRequests.waitForMatchingRequest();

    expect(blockedRequests.count()).toEqual(0);
    expect(approvedRequests.count()).toEqual(1);

    const b = approvedRequests.get(0)!.postDataJSON() as BeaconPayload;

    expect(hasFlag(b.flags, Flags.BeaconBlockedByCsp)).toBe(true);
  });
});
