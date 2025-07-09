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

  test("LoAFs are reset between SPA page transitions", async ({ page }) => {
    const loafSupported = await entryTypeSupported(page, "long-animation-frame");
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/long-animation-frames.html?injectScript=LUX.auto=false;", {
      waitUntil: "networkidle",
    });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;

    // First beacon has LoAFs
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

    // Second beacon has no LoAFs
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(200);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;

    if (loafSupported) {
      const loaf = b.loaf!;
      expect(loaf.totalDuration).toEqual(0);
      expect(loaf.entries.length).toEqual(0);
      expect(loaf.scripts.length).toEqual(0);
    } else {
      expect(b.loaf).toBeUndefined();
    }

    // Third beacon has LoAFs again
    await page.evaluate(() => LUX.init());
    await page.locator("#create-long-task").click();
    await page.waitForTimeout(50);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    b = luxRequests.get(2)!.postDataJSON() as BeaconPayload;

    if (loafSupported) {
      const loaf = b.loaf!;
      expect(loaf.totalDuration).toBeGreaterThan(0);
      expect(loaf.entries.length).toBeGreaterThan(0);
      expect(loaf.scripts.length).toBeGreaterThan(0);
    } else {
      expect(b.loaf).toBeUndefined();
    }
  });

  test("Only the slowest LoAFs are collected", async ({ page }) => {
    const MAX_ENTRIES = 3;
    const loafSupported = await entryTypeSupported(page, "long-animation-frame");
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto(
      `/long-animation-frames.html?injectScript=LUX.maxAttributionEntries=${MAX_ENTRIES};`,
      {
        waitUntil: "networkidle",
      },
    );

    // Create a mixture of short and long LoAFs
    // Short
    await page.locator("#create-long-task").click();
    await page.locator("#create-long-task").click();

    // Long
    await page.locator("#long-task-duration").fill("100");
    await page.locator("#create-long-task").click();

    // Short
    await page.locator("#long-task-duration").fill("50");
    await page.locator("#create-long-task").click();
    await page.locator("#create-long-task").click();

    // Long
    await page.locator("#long-task-duration").fill("150");
    await page.locator("#create-long-task").click();
    await page.locator("#create-long-task").click();

    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;

    if (loafSupported) {
      const loaf = b.loaf!;

      expect(loaf.entries.length).toEqual(MAX_ENTRIES);

      // The entries should all be the longer LoAFs. Note the total duration is the value from the
      // #long-task-duration input, plus a hard-coded 50ms long task in external-long.task.js.
      expect(loaf.entries[0].duration).toBeGreaterThanOrEqual(150);
      expect(loaf.entries[1].duration).toBeGreaterThanOrEqual(150);
      expect(loaf.entries[2].duration).toBeGreaterThanOrEqual(100);

      // The entries should be ordered by start time
      expect(loaf.entries[0].startTime).toBeLessThanOrEqual(loaf.entries[1].startTime);
      expect(loaf.entries[1].startTime).toBeLessThanOrEqual(loaf.entries[2].startTime);
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

        const documentScript = loafScripts.find((script) =>
          script.sourceUrl.endsWith("/long-animation-frames.html"),
        )!;
        const externalScript = loafScripts.find((script) =>
          script.sourceUrl.endsWith("/external-long-task.js"),
        )!;

        const externalUrl = new URL(externalScript.sourceUrl);
        const [externalStartTime, externalDuration] = externalScript.timings[0];
        expect(externalUrl.pathname).toEqual("/external-long-task.js");
        // Invoker has been removed to try and reduce the number of LoAF entries
        // expect(external.invoker).toEqual(external.sourceUrl);
        expect(externalScript.invoker).toEqual("");
        expect(externalScript.sourceFunctionName).toEqual("");
        expect(externalScript.totalEntries).toEqual(1);
        expect(externalScript.totalDuration).toBeBetween(49, 59);
        expect(externalStartTime).toBeGreaterThanOrEqual(inp.startTime);
        expect(externalDuration).toBeBetween(49, 59);

        const documentUrl = new URL(documentScript.sourceUrl);
        const [documentStartTime, documentDuration] = documentScript.timings[0];

        expect(documentUrl.pathname).toEqual("/long-animation-frames.html");
        // Invoker has been removed to try and reduce the number of LoAF entries
        // expect(onload.invoker).toEqual("SCRIPT[src=external-long-task.js].onload");
        expect(documentScript.invoker).toEqual("");
        expect(documentScript.sourceFunctionName).toEqual("");
        expect(documentScript.totalEntries).toEqual(1);
        expect(documentScript.totalDuration).toBeBetween(49, 59);
        expect(documentStartTime).toBeGreaterThanOrEqual(inp.startTime);
        expect(documentDuration).toBeBetween(49, 59);
      } else {
        expect(loafScripts.length).toEqual(0);
      }
    }
  });
});
