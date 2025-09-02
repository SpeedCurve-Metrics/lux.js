import { test, expect, chromium, Browser } from "@playwright/test";
import Flags from "../../src/flags";
import BeaconStore from "../helpers/beacon-store";
import {
  getElapsedMs,
  getNavTiming,
  getSearchParam,
  hasFlag,
  parseUserTiming,
} from "../helpers/lux";
import * as Shared from "../helpers/shared-tests";

test.describe("BF cache integration", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "bfcache tests only work reliably in Chromium",
  );

  let browser: Browser, browserName: string;

  test.beforeAll(async () => {
    browser = await chromium.launch({
      headless: false,
      ignoreDefaultArgs: ["--disable-back-forward-cache"],
    });
    browserName = browser.browserType().name();
  });

  test.afterAll(async () => {
    if (browser) {
      await browser.close();
    }
  });

  test("a beacon is sent on BF cache restore when LUX.newBeaconOnPageShow=true", async () => {
    const page = await browser.newPage();
    const store = await BeaconStore.open();
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

    // This is not a SPA so the InitCalled flag should not be present on either beacon, even though
    // the bfcache implementation calls init() to initialise a fresh beacon.
    expect(hasFlag(firstBeacon, Flags.InitCalled)).toBe(false);
    expect(hasFlag(bfcBeacon, Flags.InitCalled)).toBe(false);

    // Test the page stats are correct for both beacons
    Shared.testPageStats({ beacon: firstBeacon, page, browserName }, true);
    Shared.testPageStats({ beacon: bfcBeacon, page, browserName }, true);

    // Test the metrics look correct for the BF cache beacon
    const bfcNT = getNavTiming(bfcBeacon);

    // There should be no redirects for this test page
    expect(bfcNT.redirectStart).toBeUndefined();
    expect(bfcNT.redirectEnd).toBeUndefined();

    expect(bfcNT.secureConnectionStart).toBeUndefined();
    expect(bfcNT.activationStart).toEqual(0);
    expect(bfcNT.fetchStart).toEqual(0);
    expect(bfcNT.domainLookupStart).toEqual(0);
    expect(bfcNT.domainLookupEnd).toEqual(0);
    expect(bfcNT.connectStart).toEqual(0);
    expect(bfcNT.connectEnd).toEqual(0);
    expect(bfcNT.requestStart).toEqual(0);
    expect(bfcNT.responseStart).toEqual(0);
    expect(bfcNT.responseEnd).toEqual(0);
    expect(bfcNT.domInteractive).toEqual(0);
    expect(bfcNT.domContentLoadedEventStart).toEqual(0);
    expect(bfcNT.domContentLoadedEventEnd).toEqual(0);
    expect(bfcNT.domComplete).toEqual(0);
    expect(bfcNT.startRender).toEqual(0);
    expect(bfcNT.firstContentfulPaint).toEqual(0);
    expect(bfcNT.largestContentfulPaint).toEqual(0);

    // The bfcache beacon should still have a measurable load time, which will be the time it took
    // for the page to be restored from cache.
    expect(bfcNT.loadEventEnd).toBeGreaterThan(0);
    expect(bfcNT.loadEventEnd).toBeLessThan(timeAfterBeacon);
    expect(bfcNT.loadEventStart).toEqual(bfcNT.loadEventEnd);

    const firstET = parseUserTiming(getSearchParam(firstBeacon, "ET"));
    const bfcET = parseUserTiming(getSearchParam(bfcBeacon, "ET"));

    expect(firstET["eve-image"].startTime).toBeGreaterThanOrEqual(getNavTiming(firstBeacon, "ls")!);
    expect(firstET["eve-image-delayed"]).toBeUndefined();

    expect(bfcET["eve-image"].startTime).toEqual(0);
    expect(bfcET["eve-image-delayed"].startTime).toBeGreaterThanOrEqual(
      getNavTiming(bfcBeacon, "le")!,
    );
    expect(bfcET["eve-image-delayed"].startTime).toBeLessThan(timeAfterBeacon);
  });

  test("a beacon is not sent on BF cache restore by default", async () => {
    const page = await browser.newPage();
    const store = await BeaconStore.open();
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

  test("redirect time is not counted for BF cache restores", async () => {
    const page = await browser.newPage();
    const store = await BeaconStore.open();
    const MAX_MEASURE_TIME = 1200;
    const IMAGE_DELAY = 1200;

    const injectScript = [
      "LUX.newBeaconOnPageShow=true",
      `LUX.maxMeasureTime=${MAX_MEASURE_TIME}`,
    ].join(";");

    // Open up the first page with a redirect
    const redirectTo = encodeURIComponent(
      `/element-timing.html?useBeaconStore=${store.id}&imageDelay=${IMAGE_DELAY}&injectScript=${injectScript}`,
    );
    await page.goto(`/default.html?redirectTo=${redirectTo}&redirectDelay=50`, {
      waitUntil: "networkidle",
    });

    // Navigate to another page and triggers the browser's back function after onload. Note we do
    // this instead of using page.goBack() because of https://github.com/microsoft/playwright/issues/22733
    await page.goto("/default.html?injectScript=LUX.auto=false;window.onload=()=>history.back();");
    await expect.poll(() => store.countAll(), { timeout: 5000 }).toEqual(2);
    await page.close();
    const [, bfcBeacon] = (await store.findAll()).map((beacon) => new URL(beacon.url));

    const bfcNT = getNavTiming(bfcBeacon);

    expect(bfcNT.redirectStart).toBeUndefined();
    expect(bfcNT.redirectEnd).toBeUndefined();
  });
});
