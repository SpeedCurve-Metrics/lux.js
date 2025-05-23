import { Page, expect } from "@playwright/test";
import { getNavTiming, getPageStat, getSearchParam } from "./lux";

type SharedTestArgs = {
  page: Page;
  browserName: string;
  beacon: URL;
  isSoftNavigation?: boolean;
};

export function testPageStats(args: SharedTestArgs, hasImages = false) {
  const { page, browserName, beacon, isSoftNavigation = false } = args;

  // There is a single external script: lux.js.
  expect(getPageStat(beacon, "ns")).toEqual(isSoftNavigation ? 0 : 1);

  // The LUX inline script
  expect(getPageStat(beacon, "is")).toBeGreaterThan(0);

  // No stylesheets
  expect(getPageStat(beacon, "ss")).toEqual(0);
  expect(getPageStat(beacon, "ic")).toEqual(0);

  // No blocking scripts or stylesheets
  if (browserName === "chromium") {
    expect(getPageStat(beacon, "bs")).toEqual(0);
    expect(getPageStat(beacon, "bc")).toEqual(0);
  } else {
    expect(getPageStat(beacon, "bs")).toBeNull();
    expect(getPageStat(beacon, "bc")).toBeNull();
  }

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
