import { test, expect } from "@playwright/test";
import type { BeaconPayload } from "../../../src/beacon";
import { entryTypeSupported } from "../../helpers/browsers";
import { getElapsedMs } from "../../helpers/lux";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon INP", () => {
  test("INP is measured", async ({ page }) => {
    const blockingTime = 90;
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto(`/interaction.html?blockFor=${blockingTime}`, { waitUntil: "networkidle" });

    const timeBeforeClick = await getElapsedMs(page);
    await page.locator("#button-with-js").click({ force: true });
    await page.waitForTimeout(100);
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const loafSupported = await entryTypeSupported(page, "long-animation-frame");
    const inpSupported = await entryTypeSupported(page, "event");

    if (inpSupported) {
      const inp = b.inp!;
      expect(inp.startTime).toBeGreaterThanOrEqual(timeBeforeClick);
      expect(inp.value).toBeGreaterThanOrEqual(blockingTime);
      expect(inp.attribution!.elementSelector).toEqual("#button-with-js");
      expect(inp.attribution!.elementType).toEqual("BUTTON");

      if (loafSupported) {
        const { loafScripts } = inp.attribution!;

        expect(loafScripts.length).toEqual(1);
        expect(loafScripts[0].totalDuration).toBeGreaterThanOrEqual(blockingTime);
        expect(loafScripts[0].totalPauseDuration).toBeLessThanOrEqual(0);
        expect(loafScripts[0].totalForcedStyleAndLayoutDuration).toBeLessThanOrEqual(0);
        expect(new URL(loafScripts[0].sourceUrl).pathname).toEqual("/interaction.html");
        // Invoker has been removed to try and reduce the number of LoAF entries
        // expect(loafScripts[0].invoker).toEqual("BUTTON#button-with-js.onpointerdown");
        expect(loafScripts[0].invoker).toEqual("");
      }
    } else {
      expect(b.inp).toBeUndefined();
    }
  });

  test("INP is reset between SPA page transitions", async ({ page }) => {
    // Note we block for just 60ms to validate a fix for https://github.com/SpeedCurve-Metrics/lux.js/issues/85
    const blockingTime = 60;
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    const inpSupported = await entryTypeSupported(page, "event");
    await page.goto(`/interaction.html?blockFor=${blockingTime}&injectScript=LUX.auto=false;`, {
      waitUntil: "networkidle",
    });

    // Generate INP for the first page
    await page.locator("#button-with-js").click({ force: true });
    await page.waitForTimeout(100);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;

    if (inpSupported) {
      expect(b.inp!.value).toBeGreaterThanOrEqual(blockingTime);
      expect(b.inp!.attribution!.elementSelector).toEqual("#button-with-js");
    } else {
      expect(b.inp).toBeUndefined();
    }

    // Second page has no INP
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.inp).toBeUndefined();

    // Third page has INP from a new interaction
    const beforeInit = await getElapsedMs(page);
    await page.evaluate(() => LUX.init());
    const beforeClick = await getElapsedMs(page);
    await page.locator("#button-with-js").click({ force: true });
    await page.waitForTimeout(100);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    b = luxRequests.get(2)!.postDataJSON() as BeaconPayload;

    if (inpSupported) {
      expect(b.inp!.startTime).toBeGreaterThanOrEqual(beforeClick - beforeInit);
      expect(b.inp!.value).toBeGreaterThanOrEqual(blockingTime);
      expect(b.inp!.value).toBeLessThan(104);
      expect(b.inp!.attribution!.elementSelector).toEqual("#button-with-js");
    } else {
      expect(b.inp).toBeUndefined();
    }
  });
});
