import { Page, expect } from "@playwright/test";
import { BeaconPayload } from "../../src/beacon";
import { SNIPPET_VERSION, VERSION } from "../../src/version";
import { getNavTiming, getPageStat, getSearchParam } from "./lux";

type SharedTestArgs = {
  page: Page;
  browserName: string;
  beacon: URL;
};

export function testPageStats({ page, browserName, beacon }: SharedTestArgs, hasImages = false) {
  // There is a single external script: lux.js.
  expect(getPageStat(beacon, "ns")).toEqual(1);

  // No blocking scripts
  expect(getPageStat(beacon, "bs")).toEqual(0);

  // The LUX inline script
  expect(getPageStat(beacon, "is")).toBeGreaterThan(0);

  // No stylesheets
  expect(getPageStat(beacon, "ss")).toEqual(0);
  expect(getPageStat(beacon, "bc")).toEqual(0);
  expect(getPageStat(beacon, "ic")).toEqual(0);

  if (hasImages) {
    expect(getPageStat(beacon, "ia")).toBeGreaterThan(0);
    expect(getPageStat(beacon, "it")).toBeGreaterThan(0);
  } else {
    expect(getPageStat(beacon, "ia")).toEqual(0);
    expect(getPageStat(beacon, "it")).toEqual(0);
  }

  // DOM depth and number of DOM elements
  expect(getPageStat(beacon, "dd")).toBeGreaterThan(1);
  expect(getPageStat(beacon, "nd")).toBeGreaterThan(1);

  // Viewport info
  const viewport = page.viewportSize()!;
  expect(getPageStat(beacon, "vh")).toEqual(viewport.height);
  expect(getPageStat(beacon, "vw")).toEqual(viewport.width);
  expect(getPageStat(beacon, "dh")).toEqual(viewport.height);
  expect(getPageStat(beacon, "dw")).toEqual(viewport.width);

  if (browserName !== "webkit") {
    // Document transfer size
    expect(getPageStat(beacon, "ds")).toBeGreaterThan(1);
  }

  // Connection type
  const ct = getSearchParam(beacon, "PS")?.match(/ct([^_]+)/) || [];

  // Delivery type
  const dt = getSearchParam(beacon, "PS")?.match(/dt([^_]+)/);

  if (browserName === "chromium") {
    expect(ct[1]).toEqual("4G");
    expect(dt![1]).toEqual("(empty string)");
    expect(getPageStat(beacon, "dm")).toBeGreaterThan(0);
  } else {
    expect(ct.length).toEqual(0);
    expect(dt).toBeNull();
    expect(getPageStat(beacon, "dm")).toBeNull();
  }

  // No errors
  expect(getPageStat(beacon, "er")).toEqual(0);

  // "Normal" navigation type
  expect(getPageStat(beacon, "nt")).toEqual(0);
}

export function testNavigationTiming({ browserName, beacon }: SharedTestArgs) {
  const NT = getNavTiming(beacon);

  // Secure connection time will be null because localhost is insecure
  expect(NT.secureConnectionStart).toBeUndefined();

  // activationStart will be zero for pages that are not prerendered
  expect(NT.activationStart).toEqual(0);

  // Fetch, connect, and DNS times are probably zero for localhost
  expect(NT.fetchStart).toBeGreaterThanOrEqual(0);
  expect(NT.domainLookupStart).toBeGreaterThanOrEqual(0);
  expect(NT.domainLookupEnd).toBeGreaterThanOrEqual(0);
  expect(NT.connectStart).toBeGreaterThanOrEqual(0);
  expect(NT.connectEnd).toBeGreaterThanOrEqual(0);
  expect(NT.requestStart).toBeGreaterThanOrEqual(0);
  expect(NT.responseStart).toBeGreaterThanOrEqual(0);
  expect(NT.responseEnd).toBeGreaterThanOrEqual(0);

  // Other metrics will be non-zero for all pages
  expect(NT.domInteractive).toBeGreaterThan(0);
  expect(NT.domContentLoadedEventStart).toBeGreaterThan(0);
  expect(NT.domContentLoadedEventEnd).toBeGreaterThan(0);
  expect(NT.domComplete).toBeGreaterThan(0);
  expect(NT.loadEventStart).toBeGreaterThan(0);
  expect(NT.loadEventEnd).toBeGreaterThan(0);
  expect(NT.startRender).toBeGreaterThan(0);
  expect(NT.firstContentfulPaint).toBeGreaterThan(0);

  if (browserName === "chromium") {
    // Only Chromium records LCP
    expect(NT.largestContentfulPaint).toBeGreaterThan(0);
  }
}

export function testPostBeacon(beacon: BeaconPayload, hasSnippet = true) {
  expect(beacon.customerId).toEqual("10001");
  expect(beacon.flags).toBeGreaterThan(0);
  expect(beacon.pageId).toBeTruthy();
  expect(beacon.sessionId).toBeTruthy();
  expect(beacon.measureDuration).toBeGreaterThan(0);
  expect(beacon.scriptVersion).toEqual(VERSION);

  if (hasSnippet) {
    // The es2020 variant is set in tests/server.mjs
    expect(beacon.snippetVersion).toEqual(`${SNIPPET_VERSION}-es2020`);
  } else {
    expect(beacon.snippetVersion).toBeUndefined();
  }
}
