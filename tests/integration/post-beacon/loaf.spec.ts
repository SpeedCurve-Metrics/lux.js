import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { entryTypeSupported } from "../../helpers/browsers";
import RequestInterceptor from "../../request-interceptor";

test.describe("POST beacon LoAF", () => {
  test("LoAFs are measured", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/long-animation-frames.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
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

  test("LoAFs are collected as INP attribution", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/long-animation-frames.html", { waitUntil: "networkidle" });
    await page.locator("#create-long-task").click();
    await page.waitForTimeout(1000);
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const inpSupported = await entryTypeSupported(page, "event");
    const loafSupported = await entryTypeSupported(page, "long-animation-frame");
    const inp = b.inp!;

    if (!inpSupported) {
      expect(inp).toBeUndefined();
    } else {
      expect(inp.value).toBeGreaterThanOrEqual(0);

      const loafScripts = inp.attribution!.loafScripts;

      if (loafSupported) {
        expect(loafScripts.length).toEqual(2);

        const external = loafScripts[0];
        const externalUrl = new URL(external.sourceUrl);
        const [externalStartTime, externalDuration] = external.timings[0];
        expect(externalUrl.pathname).toEqual("/external-long-task.js");
        // Invoker has been removed to try and reduce the number of LoAF entries
        // expect(external.invoker).toEqual(external.sourceUrl);
        expect(external.invoker).toEqual("");
        expect(external.sourceFunctionName).toEqual("");
        expect(external.totalEntries).toEqual(1);
        expect(external.totalDuration).toBeBetween(49, 59);
        expect(externalStartTime).toBeGreaterThanOrEqual(inp.startTime);
        expect(externalDuration).toBeBetween(49, 59);

        const onload = loafScripts[1];
        const onloadUrl = new URL(onload.sourceUrl);
        const [onloadStartTime, onloadDuration] = onload.timings[0];

        expect(onloadUrl.pathname).toEqual("/long-animation-frames.html");
        // Invoker has been removed to try and reduce the number of LoAF entries
        // expect(onload.invoker).toEqual("SCRIPT[src=external-long-task.js].onload");
        expect(onload.invoker).toEqual("");
        expect(onload.sourceFunctionName).toEqual("");
        expect(onload.totalEntries).toEqual(1);
        expect(onload.totalDuration).toBeBetween(49, 59);
        expect(onloadStartTime).toBeGreaterThanOrEqual(inp.startTime);
        expect(onloadDuration).toBeBetween(49, 59);
      } else {
        expect(loafScripts.length).toEqual(0);
      }
    }
  });
});
