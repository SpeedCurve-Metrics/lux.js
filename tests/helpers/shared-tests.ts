import { Page, expect } from "@playwright/test";
import { getNavTiming, getPageStat, getSearchParam } from "./lux";

type SharedTestArgs = {
  page: Page;
  browserName: string;
  beacon: URL;
};

export function testPageStats({ page, browserName, beacon }: SharedTestArgs) {
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

  // No images
  expect(getPageStat(beacon, "ia")).toEqual(0);
  expect(getPageStat(beacon, "it")).toEqual(0);

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

  if (browserName === "chromium") {
    expect(ct[1]).toEqual("4G");
  } else {
    expect(ct.length).toEqual(0);
  }

  // No errors
  expect(getPageStat(beacon, "er")).toEqual(0);

  // "Normal" navigation type
  expect(getPageStat(beacon, "nt")).toEqual(0);

  // Device memory
  if (browserName === "chromium") {
    expect(getPageStat(beacon, "dm")).toBeGreaterThan(0);
  } else {
    expect(getPageStat(beacon, "dm")).toBeNull();
  }
}

export function testNavigationTiming({ browserName, beacon }: SharedTestArgs) {
  const NT = getNavTiming(beacon);

  // Secure connection time will be null because localhost is insecure
  expect(NT["sc"]).toBeUndefined();

  // activationStart will be zero for pages that are not prerendered
  expect(NT["as"], "activationStart should be 0").toEqual(0);

  // Fetch, connect, and DNS times are probably zero for localhost
  expect(NT["fs"], "fetchStart should be >=0").toBeGreaterThanOrEqual(0);
  expect(NT["ds"], "domainLookupStart should be >=0").toBeGreaterThanOrEqual(0);
  expect(NT["de"], "domainLookupEnd should be >=0").toBeGreaterThanOrEqual(0);
  expect(NT["cs"], "connectStart should be >=0").toBeGreaterThanOrEqual(0);
  expect(NT["ce"], "connectEnd should be >=0").toBeGreaterThanOrEqual(0);
  expect(NT["qs"], "requestStart should be >=0").toBeGreaterThanOrEqual(0);

  // Other metrics will be non-zero for all pages
  expect(NT["oi"], "domInteractive should be >0").toBeGreaterThan(0);
  expect(NT["os"], "domContentLoadedEventStart should be >0").toBeGreaterThan(0);
  expect(NT["oe"], "domContentLoadedEventEnd should be >0").toBeGreaterThan(0);
  expect(NT["fc"], "FCP should be >0").toBeGreaterThan(0);
  expect(NT["oc"], "domComplete should be >0").toBeGreaterThan(0);
  expect(NT["ls"], "loadEventStart should be >0").toBeGreaterThan(0);
  expect(NT["le"], "loadEventEnd should be >0").toBeGreaterThan(0);

  if (browserName === "chromium") {
    // Only Chromium records start render and LCP
    expect(NT["sr"], "start render should be >0").toBeGreaterThan(0);
    expect(NT["lc"], "LCP should be >0").toBeGreaterThan(0);
  }

  if (browserName === "firefox") {
    // Firefox can record responseStart and responseEnd as zero
    expect(NT["bs"], "responseStart should be >=0").toBeGreaterThanOrEqual(0);
    expect(NT["be"], "responseEnd should be >=0").toBeGreaterThanOrEqual(0);
  }

  if (browserName !== "firefox") {
    // All browsers but Firefox record responseStart and responseEnd as non-zero
    expect(NT["bs"], "responseStart should be >=0").toBeGreaterThan(0);
    expect(NT["be"], "responseEnd should be >=0").toBeGreaterThan(0);
  }
}
