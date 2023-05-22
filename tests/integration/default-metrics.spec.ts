import { test, expect } from "@playwright/test";
import {
  getCpuStat,
  getLuxJsStat,
  getNavTiming,
  getPageStat,
  getSearchParam,
} from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("Default metrics in auto mode", () => {
  test("basic functionality", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    // LUX beacon is automatically sent
    expect(luxRequests.count()).toEqual(1);

    // LUX version is included in the beacon
    expect(parseInt(getSearchParam(beacon, "v"))).toBeGreaterThan(200);

    // customer ID is detected correctly
    expect(getSearchParam(beacon, "id")).toEqual("10001");

    // page ID and session ID are sent
    expect(getSearchParam(beacon, "sid").length).toBeGreaterThan(0);
    expect(getSearchParam(beacon, "uid").length).toBeGreaterThan(0);

    // interaction data is not sent when there are no interactions
    expect(beacon.searchParams.get("IX")).toBeNull();

    if (browserName === "chromium") {
      // CLS is set to zero when there are no layout shifts
      expect(parseFloat(getSearchParam(beacon, "CLS"))).toEqual(0);
    } else {
      expect(beacon.searchParams.get("CLS")).toBeNull();
    }

    // hostname and pathname are set
    expect(getSearchParam(beacon, "HN")).toEqual("localhost");
    expect(getSearchParam(beacon, "PN")).toEqual("/default.html");
  });

  test("long tasks", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    if (browserName === "chromium") {
      // Total "script" time
      expect(getCpuStat(beacon, "s")).toEqual(0);

      // Number of long tasks
      expect(getCpuStat(beacon, "n")).toEqual(0);

      // Median long task duration
      expect(getCpuStat(beacon, "d")).toEqual(0);

      // Longest long task duration
      expect(getCpuStat(beacon, "x")).toEqual(0);

      // First CPU Idle
      expect(getCpuStat(beacon, "i")).toBeGreaterThan(1);
    } else {
      expect(beacon.searchParams.get("CPU")).toBeNull();
    }
  });

  test("long tasks before the snippet", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/head-long-tasks.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    if (browserName === "chromium") {
      expect(getCpuStat(beacon, "s")).toEqual(110);
      expect(getCpuStat(beacon, "n")).toEqual(2);
      expect(getCpuStat(beacon, "d")).toEqual(55);
      expect(getCpuStat(beacon, "x")).toEqual(60);
      expect(getCpuStat(beacon, "i")).toBeGreaterThan(1);
    } else {
      expect(beacon.searchParams.get("CPU")).toBeNull();
    }
  });

  test("page stats", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

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
  });

  test("navigation timing", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const beforeNav = new Date().getTime();
    await page.goto("/default.html");
    const afterNav = new Date().getTime();
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    // navigationStart should be a timestamp
    expect(parseInt(beacon.searchParams.get("NT")!)).toBeGreaterThanOrEqual(beforeNav);
    expect(parseInt(beacon.searchParams.get("NT")!)).toBeLessThan(afterNav);

    // There should be no redirects for this test page
    expect(getNavTiming(beacon, "rs")).toBeNull();
    expect(getNavTiming(beacon, "re")).toBeNull();

    // Fetch, connect, and DNS times are probably zero for localhost
    expect(getNavTiming(beacon, "fs")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "ds")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "de")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "cs")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "ce")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "qs")).toBeGreaterThanOrEqual(0);

    // Secure connection time will be null because localhost is insecure
    expect(beacon.searchParams.get("sc")).toBeNull();

    // Everything else should have be non-zero
    expect(getNavTiming(beacon, "bs")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "be")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "oi")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "os")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "oe")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "oc")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "ls")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "le")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "fc")).toBeGreaterThan(0);

    if (browserName === "chromium") {
      // activationStart will be zero
      expect(getNavTiming(beacon, "as")).toEqual(0);
      expect(getNavTiming(beacon, "sr")).toBeGreaterThan(0);
      expect(getNavTiming(beacon, "lc")).toBeGreaterThan(0);
    }
  });

  test("navigation timing with a redirect", async ({ page }) => {
    const redirectDelay = 50;
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(`/default.html?redirectTo=/default.html&redirectDelay=${redirectDelay}`);
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    // There should be no redirects for this test page
    expect(getNavTiming(beacon, "rs")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "re")).toBeGreaterThanOrEqual(redirectDelay);
  });

  test("lux.js internal stats", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    // metrics about the lux.js script are sent
    expect(getLuxJsStat(beacon, "d")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "t")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "f")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "c")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "n")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "e")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "r")).toEqual(100);
    expect(getLuxJsStat(beacon, "l")).toBeGreaterThan(0);
    expect(getLuxJsStat(beacon, "s")).toBeGreaterThan(0);

    if (browserName !== "webkit") {
      // WebKit seems flaky with response size metrics
      expect(getLuxJsStat(beacon, "x")).toBeGreaterThan(0);
    }

    // interaction metrics are not sent with no interaction
    expect(beacon.searchParams.get("FID")).toBeNull();
    expect(beacon.searchParams.get("INP")).toBeNull();
    expect(beacon.searchParams.get("IX")).toBeNull();
  });
});
