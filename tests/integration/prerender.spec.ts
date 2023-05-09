import { test, expect, Page, Browser } from "@playwright/test";
import { chromium } from "playwright";
import Flags from "../../src/flags.js";
import BeaconStore from "../helpers/beacon-store.js";
import {
  getCpuStat,
  getNavTiming,
  getSearchParam,
  hasFlag,
  parseUserTiming,
} from "../helpers/lux.js";

test.describe("LUX prerender support", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Prerendering is only supported in Chromium"
  );

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
      `/prerender-index.html?useBeaconStore=${store.id}&injectScript=LUX.trackHiddenPages=true`
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
    const CLICK_WAIT_TIME = 500;
    const IMAGE_DELAY_TIME = 1000;

    await page.goto(
      [
        `/prerender-index.html?useBeaconStore=${store.id}`,
        `imageDelay=${IMAGE_DELAY_TIME}`,
        `injectScript=${[
          `LUX.minMeasureTime=${IMAGE_DELAY_TIME + CLICK_WAIT_TIME}`,
          `if (location.pathname === "/prerender-page.html") { createLongTask(${LONG_TASK_TIME}); }`,
        ].join(";")}`,
      ].join("&")
    );

    // This setTimeout hack is to get around a bug in Playwright where it's not possible to interact
    // with a prerendered page. See https://github.com/microsoft/playwright/issues/22733
    await page.evaluate(
      (timeout) => setTimeout(() => document.getElementById("next-page-link")!.click(), timeout),
      CLICK_WAIT_TIME
    );

    await expect
      .poll(async () => (await store.findByPathname("/prerender-page.html")).length, {
        timeout: 5000,
      })
      .toEqual(1);

    const beacon = new URL((await store.findByPathname("/prerender-page.html"))[0].url);
    const activationStart = getNavTiming(beacon, "as")!;

    expect(hasFlag(beacon, Flags.PageWasPrerendered)).toBe(true);

    // Navigation timing - activationStart should be roughly equal to when the click happened.
    // Everything else should be zero, because the user's experience of these metrics is that
    // they were instant.
    expect(activationStart).toBeGreaterThanOrEqual(CLICK_WAIT_TIME);
    expect(getNavTiming(beacon, "fs")).toEqual(0);
    expect(getNavTiming(beacon, "ds")).toEqual(0);
    expect(getNavTiming(beacon, "de")).toEqual(0);
    expect(getNavTiming(beacon, "cs")).toEqual(0);
    expect(getNavTiming(beacon, "ce")).toEqual(0);
    expect(getNavTiming(beacon, "qs")).toEqual(0);
    expect(getNavTiming(beacon, "bs")).toEqual(0);
    expect(getNavTiming(beacon, "be")).toEqual(0);
    expect(getNavTiming(beacon, "oi")).toEqual(0);
    expect(getNavTiming(beacon, "os")).toEqual(0);
    expect(getNavTiming(beacon, "oe")).toEqual(0);
    expect(getNavTiming(beacon, "oc")).toEqual(0);
    expect(getNavTiming(beacon, "ls")).toEqual(0);
    expect(getNavTiming(beacon, "le")).toEqual(0);

    // Element timing
    const ET = parseUserTiming(getSearchParam(beacon, "ET"));

    // The first image should have loaded before activationStart
    expect(ET["eve-image"].startTime).toBeLessThan(activationStart);

    // The second image was delayed and should have loaded after IMAGE_DELAY TIME, but relative
    // to activationStart.
    expect(ET["charlie-image"].startTime).toBeGreaterThanOrEqual(
      IMAGE_DELAY_TIME - activationStart
    );

    // Paint metrics
    expect(getNavTiming(beacon, "sr")).toBeLessThan(activationStart);
    expect(getNavTiming(beacon, "fc")).toBeLessThan(activationStart);
    expect(getNavTiming(beacon, "lc")).toBeGreaterThanOrEqual(ET["charlie-image"].startTime);

    // CPU metrics
    const longTaskCount = getCpuStat(beacon, "n");
    const longTaskTotal = getCpuStat(beacon, "s");
    const longTaskMedian = getCpuStat(beacon, "d");
    const longTaskMax = getCpuStat(beacon, "x");
    const firstCpuIdle = getCpuStat(beacon, "i");

    expect(longTaskCount).toEqual(1);
    expect(longTaskTotal).toBeGreaterThanOrEqual(LONG_TASK_TIME);
    expect(longTaskMedian).toEqual(longTaskTotal);
    expect(longTaskMax).toEqual(longTaskTotal);
    expect(firstCpuIdle).toBeLessThan(activationStart);

    // The same Playwright bug mentioned above means we have to forcefully close the page after this test
    await page.close();
  });
});
