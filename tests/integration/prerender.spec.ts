import { test, expect } from "@playwright/test";
import { chromium } from "playwright";
import Flags from "../../src/flags.js";
import BeaconStore from "../helpers/beacon-store.js";
import { hasFlag } from "../helpers/lux.js";

test.describe("LUX prerender support", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Prerendering is only supported in Chromium"
  );

  // The tests in this file rely on the SQLite beacon store to inspect beacon requests. This is
  // because network requests from the prerender process cannot be intercepted. To make sure that
  // requests from each test do not interfere with each other, we run these tests in serial.
  test.describe.configure({ mode: "serial" });

  let page, store: BeaconStore;

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
    await expect.poll(async () => (await store.findAll()).length, { timeout: 50000 }).toEqual(2);

    const beacons = await store.findAll();

    expect(beacons[0].pathname).toEqual("/prerender-index.html");
    expect(hasFlag(new URL(beacons[0].url), Flags.PageWasPrerendered)).toBe(false);
    expect(hasFlag(new URL(beacons[0].url), Flags.VisibilityStateNotVisible)).toBe(false);

    expect(beacons[1].pathname).toEqual("/prerender-page.html");
    expect(hasFlag(new URL(beacons[1].url), Flags.PageWasPrerendered)).toBe(true);
    expect(hasFlag(new URL(beacons[1].url), Flags.VisibilityStateNotVisible)).toBe(true);
  });
});
