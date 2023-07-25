import { test, expect, chromium, Page, Browser } from "@playwright/test";
import Flags from "../../src/flags";
import BeaconStore from "../helpers/beacon-store";
import {
  getElapsedMs,
  getNavTiming,
  getSearchParam,
  hasFlag,
  parseUserTiming,
} from "../helpers/lux";

test.describe("BF cache integration", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "bfcache tests only work reliably in Chromium",
  );

  let browser: Browser, page: Page, store: BeaconStore;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      args: ["--headless=new"],
      ignoreDefaultArgs: ["--disable-back-forward-cache"],
    });
    page = await browser.newPage();
    store = await BeaconStore.open();
  });

  test.afterAll(async () => {
    await browser.close();
  });

  test("a beacon is sent on BF cache restore when LUX.newBeaconOnPageShow=true", async () => {
    const MAX_MEASURE_TIME = 1200;
    const IMAGE_DELAY = 1200;

    const injectScript = [
      "LUX.newBeaconOnPageShow=true",
      `LUX.maxMeasureTime=${MAX_MEASURE_TIME}`,
    ].join(";");

    // Open the first page and wait for the beacon to be sent
    await page.goto(
      `/element-timing.html?useBeaconStore=${store.id}&imageDelay=${IMAGE_DELAY}&injectScript=${injectScript}`,
      { waitUntil: "networkidle" },
    );

    // Navigate to another page and triggers the browser's back function after onload. Note we do
    // this instead of using page.goBack() because of https://github.com/microsoft/playwright/issues/22733
    await page.goto("/default.html?injectScript=LUX.auto=false;window.onload=()=>history.back();");
    await expect.poll(() => store.countAll(), { timeout: 5000 }).toEqual(2);
    const timeAfterBeacon = await getElapsedMs(page);

    // We have to forcefully close the page after this test (see above)
    await page.close();

    const [firstBeacon, bfcBeacon] = (await store.findAll()).map((beacon) => new URL(beacon.url));

    // The first beacon and bfcache beacon should have different page IDs but the same session ID
    expect(getSearchParam(firstBeacon, "sid")).not.toEqual(getSearchParam(bfcBeacon, "sid"));
    expect(getSearchParam(firstBeacon, "uid")).toEqual(getSearchParam(bfcBeacon, "uid"));

    expect(hasFlag(firstBeacon, Flags.PageWasBfCacheRestored)).toBe(false);
    expect(hasFlag(bfcBeacon, Flags.PageWasBfCacheRestored)).toBe(true);

    const bfcNT = getNavTiming(bfcBeacon);

    Object.keys(bfcNT).forEach((key) => {
      // All navigation timing except for load times should all be zero, as the page loaded instantly
      if (["ls", "le"].includes(key)) {
        return;
      }

      expect(bfcNT[key]).toEqual(0);
    });

    // The bfcache beacon should still have a measurable load time, which will be the time it took
    // for the page to be restored from cache.
    expect(bfcNT.le).toBeGreaterThan(0);
    expect(bfcNT.le).toBeLessThan(timeAfterBeacon);
    expect(bfcNT.ls).toEqual(bfcNT.le);

    const firstET = parseUserTiming(getSearchParam(firstBeacon, "ET"));
    const bfcET = parseUserTiming(getSearchParam(bfcBeacon, "ET"));

    expect(firstET["eve-image"].startTime).toBeGreaterThanOrEqual(getNavTiming(firstBeacon, "le")!);
    expect(firstET["eve-image-delayed"]).toBeUndefined();

    expect(bfcET["eve-image"]).toBeUndefined();
    expect(bfcET["eve-image-delayed"].startTime).toBeGreaterThanOrEqual(
      getNavTiming(bfcBeacon, "le")!,
    );
    expect(bfcET["eve-image-delayed"].startTime).toBeLessThan(timeAfterBeacon);
  });

  test("a beacon is not sent on BF cache restore by default", async () => {
    const MAX_MEASURE_TIME = 500;
    await page.goto(
      `/element-timing.html?useBeaconStore=${store.id}&injectScript=LUX.maxMeasureTime=${MAX_MEASURE_TIME}`,
      {
        waitUntil: "networkidle",
      },
    );
    await page.goto("/default.html?injectScript=LUX.auto=false;window.onload=()=>history.back();");
    await page.waitForTimeout(MAX_MEASURE_TIME + 100);
    await page.close();

    expect(await store.countAll()).toEqual(1);
  });
});
