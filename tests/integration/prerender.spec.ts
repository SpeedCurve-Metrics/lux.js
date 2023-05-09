import { test, expect, Page } from "@playwright/test";
import { chromium } from "playwright";
import Flags from "../../src/flags.js";
import BeaconStore from "../helpers/beacon-store.js";
import { getNavTiming, getSearchParam, hasFlag, parseUserTiming } from "../helpers/lux.js";

test.describe("LUX prerender support", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Prerendering is only supported in Chromium"
  );

  // The tests in this file rely on the SQLite beacon store to inspect beacon requests. This is
  // because network requests from the prerender process cannot be intercepted. To make sure that
  // requests from each test do not interfere with each other, we run these tests in serial.
  test.describe.configure({ mode: "serial" });

  let page: Page, store: BeaconStore;

  test.beforeAll(async () => {
    const browser = await chromium.launch({
      args: ["--headless=new"],
    });
    page = await browser.newPage();
    store = await BeaconStore.open();
  });

  test.beforeEach(async () => {
    await store.deleteByPathname("/prerender-index.html");
    await store.deleteByPathname("/prerender-page.html");
  });

  test("pages loaded by prerender speculation rules do not trigger beacons", async () => {
    await page.goto("/prerender-index.html?useBeaconStore", { waitUntil: "networkidle" });

    const beacons = await store.findAll();
    expect(beacons.length).toEqual(1);
    expect(beacons[0].pathname).toEqual("/prerender-index.html");
  });

  test("LUX.autoWhenHidden=true sends the beacon on prerendered pages", async () => {
    await page.goto("/prerender-index.html?useBeaconStore&injectScript=LUX.autoWhenHidden=true", {
      waitUntil: "networkidle",
    });

    // Wait for up to 5 seconds for there to be 2 beacons in the beacon store
    await expect.poll(async () => (await store.findAll()).length, { timeout: 5000 }).toEqual(2);

    const beacons = await store.findAll();

    expect(beacons[0].pathname).toEqual("/prerender-index.html");
    expect(hasFlag(new URL(beacons[0].url), Flags.PageWasPrerendered)).toBe(false);
    expect(hasFlag(new URL(beacons[0].url), Flags.VisibilityStateNotVisible)).toBe(false);

    expect(beacons[1].pathname).toEqual("/prerender-page.html");
    expect(hasFlag(new URL(beacons[1].url), Flags.PageWasPrerendered)).toBe(true);
    expect(hasFlag(new URL(beacons[1].url), Flags.VisibilityStateNotVisible)).toBe(true);
  });

  test("Prerendered pages a non-zero value for activationStart", async () => {
    const CLICK_WAIT_TIME = 500;
    const IMAGE_DELAY_TIME = 1000;
    const SEND_LUX_DELAY = CLICK_WAIT_TIME + IMAGE_DELAY_TIME + 100;

    await page.goto(
      [
        "/prerender-index.html?useBeaconStore",
        `imageDelay=${IMAGE_DELAY_TIME}`,
        `injectScript=LUX.auto=false;setTimeout(LUX.send, ${SEND_LUX_DELAY})`,
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

    // The same Playwright bug mentioned above means we have to forcefully close the page after this test
    await page.close();
  });
});
