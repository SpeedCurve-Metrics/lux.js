import { chromium, test, expect, Page, Browser } from "@playwright/test";
import Flags from "../../src/flags.js";
import BeaconStore from "../helpers/beacon-store.js";
import {
  getCpuStat,
  getNavTiming,
  getSearchParam,
  hasFlag,
  parseUserTiming,
} from "../helpers/lux.js";

// TODO: Figure out why prerender no longer works
test.skip(
  () => true,
  "Prerendering no longer works in Playwright's browser context. These tests will fail.",
);

test.skip(
  ({ browserName }) => browserName !== "chromium",
  "Prerendering is only supported in Chromium",
);

test.describe("LUX prerender support", () => {
  let browser: Browser, page: Page, store: BeaconStore;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      args: ["--headless=new"],
    });
    page = await browser.newPage();
    store = await BeaconStore.open();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test.beforeEach(async () => {
    await store.deleteAll();
  });

  test("pages loaded by prerender speculation rules do not trigger beacons", async () => {
    await page.goto(`/prerender-index.html?useBeaconStore=${store.id}`, {
      waitUntil: "networkidle",
    });

    const beacons = await store.findAll();
    expect(beacons.length).toEqual(1);
    expect(beacons[0].pathname).toEqual("/prerender-index.html");
  });

  test("LUX.trackHiddenPages=true sends the beacon on prerendered pages", async () => {
    await page.goto(
      `/prerender-index.html?useBeaconStore=${store.id}&injectScript=LUX.trackHiddenPages=true`,
    );

    // Wait for up to 5 seconds for there to be 2 beacons in the beacon store
    await expect.poll(() => store.countAll(), { timeout: 5000 }).toEqual(2);

    const beacons = await store.findAll();

    expect(beacons[0].pathname).toEqual("/prerender-index.html");
    expect(hasFlag(new URL(beacons[0].url), Flags.PageWasPrerendered)).toBe(false);
    expect(hasFlag(new URL(beacons[0].url), Flags.VisibilityStateNotVisible)).toBe(false);

    expect(beacons[1].pathname).toEqual("/prerender-page.html");
    expect(hasFlag(new URL(beacons[1].url), Flags.PageWasPrerendered)).toBe(true);
    expect(hasFlag(new URL(beacons[1].url), Flags.VisibilityStateNotVisible)).toBe(true);
  });

  test("metrics for prerendered pages are relative to activationStart", async () => {
    const LONG_TASK_TIME = 70;
    const PAGE_ACTIVATION_TIME = 500;
    const LONG_TASK_DELAY = 600;
    const IMAGE_DELAY_TIME = 1000;

    await page.goto(
      [
        `/prerender-index.html?useBeaconStore=${store.id}`,
        `imageDelay=${IMAGE_DELAY_TIME}`,
        `injectScript=${[
          `LUX.minMeasureTime=${IMAGE_DELAY_TIME + PAGE_ACTIVATION_TIME};`,
          "if (location.pathname === '/prerender-page.html') {",
          // Create one long task before the page is activated, which should not be recorded
          "createLongTask();",

          // And another long task after the page is activated, which should be recorded
          `setTimeout(() => createLongTask(${LONG_TASK_TIME}), ${LONG_TASK_DELAY});`,
          "}",
        ].join("")}`,
      ].join("&"),
    );

    // This setTimeout hack is to get around a bug in Playwright where it's not possible to interact
    // with a prerendered page. See https://github.com/microsoft/playwright/issues/22733
    await page.evaluate(
      (timeout) => setTimeout(() => document.getElementById("next-page-link")!.click(), timeout),
      PAGE_ACTIVATION_TIME,
    );

    await expect
      .poll(async () => (await store.findByPathname("/prerender-page.html")).length, {
        timeout: 5000,
      })
      .toEqual(1);

    const beacon = new URL((await store.findByPathname("/prerender-page.html"))[0].url);
    const NT = getNavTiming(beacon);

    expect(hasFlag(beacon, Flags.PageWasPrerendered)).toBe(true);

    // Navigation timing - activationStart should be roughly equal to when the click happened.
    // Everything else should be zero, because the user's experience of these metrics is that
    // they were instant.
    expect(NT.activationStart).toBeGreaterThanOrEqual(PAGE_ACTIVATION_TIME);
    expect(NT.fetchStart).toEqual(0);
    expect(NT.domainLookupStart).toEqual(0);
    expect(NT.domainLookupEnd).toEqual(0);
    expect(NT.connectStart).toEqual(0);
    expect(NT.connectEnd).toEqual(0);
    expect(NT.requestStart).toEqual(0);
    expect(NT.responseStart).toEqual(0);
    expect(NT.responseEnd).toEqual(0);
    expect(NT.domInteractive).toEqual(0);
    expect(NT.domContentLoadedEventStart).toEqual(0);
    expect(NT.domContentLoadedEventEnd).toEqual(0);
    expect(NT.domComplete).toEqual(0);
    expect(NT.loadEventStart).toEqual(0);
    expect(NT.loadEventEnd).toEqual(0);

    // Element timing
    const ET = parseUserTiming(getSearchParam(beacon, "ET"));

    // Despite having a delay of 200ms, the first image will load almost instantly because it has
    // been prerendered.
    expect(ET["eve-image"].startTime).toBeLessThan(50);

    // The second image was delayed enough that it loaded after page activation.
    expect(ET["charlie-image"].startTime).toBeGreaterThanOrEqual(
      IMAGE_DELAY_TIME - NT.activationStart,
    );

    // Paint metrics
    expect(NT.startRender).toBeLessThan(NT.activationStart);
    expect(NT.firstContentfulPaint).toBeLessThan(NT.activationStart);
    expect(NT.largestContentfulPaint).toBeGreaterThanOrEqual(ET["charlie-image"].startTime);

    // CPU metrics
    // There are two long tasks created on the prerendered page: the first 50ms task occurs before
    // the page is activated, and is ignored. The second 70ms task occurs after the page is
    // activated, and is recorded.
    const longTaskCount = getCpuStat(beacon, "n");
    const longTaskTotal = getCpuStat(beacon, "s");
    const longTaskMedian = getCpuStat(beacon, "d");
    const longTaskMax = getCpuStat(beacon, "x");
    const firstCpuIdle = getCpuStat(beacon, "i");

    expect(longTaskCount).toEqual(1);
    expect(longTaskTotal).toBeGreaterThanOrEqual(LONG_TASK_TIME);
    expect(longTaskTotal).toBeLessThan(LONG_TASK_TIME + 50);
    expect(longTaskMedian).toEqual(longTaskTotal);
    expect(longTaskMax).toEqual(longTaskTotal);
    expect(firstCpuIdle).toBeGreaterThanOrEqual(LONG_TASK_DELAY - NT.activationStart);
    expect(firstCpuIdle).toBeLessThan(LONG_TASK_DELAY);

    // The same Playwright bug mentioned above means we have to forcefully close the page after this test
    await page.close();
  });
});
