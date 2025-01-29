import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { entryTypeSupported } from "../../helpers/browsers";
import { getNavigationTimingMs } from "../../helpers/lux";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon LoAF", () => {
  test("LoAFs are measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/long-animation-frames.html", { waitUntil: "networkidle" });
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const loafSupported = await entryTypeSupported(page, "long-animation-frame");

    if (loafSupported) {
      const loaf = b.loaf!;
      expect(loaf.totalBlockingDuration).toBeGreaterThan(0);
      expect(loaf.totalDuration).toBeGreaterThan(0);
      expect(loaf.totalEntries).toBeGreaterThan(0);
      expect(loaf.totalStyleAndLayoutDuration).toBeGreaterThan(0);
      expect(loaf.totalWorkDuration).toBeGreaterThan(0);
      expect(loaf.entries.length).toBeGreaterThan(0);
      expect(loaf.scripts.length).toBeGreaterThan(0);
    } else {
      expect(b.loaf).toBeUndefined();
    }
  });
});
