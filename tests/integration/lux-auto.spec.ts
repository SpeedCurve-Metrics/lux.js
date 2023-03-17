import { getCpuStat, getLuxJsStat, getNavTiming, getPageStat } from "../helpers/lux";

const testPages = [
  ["default page", "/default.html"],
  ["default page with early longtasks", "/head-long-tasks.html"],
];

describe.each(testPages)("%s", (_, testPage) => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
  let beacon: URL;

  beforeAll(async () => {
    luxRequests.reset();
    await navigateTo(testPage);
    beacon = luxRequests.getUrl(0);
  });

  test("LUX beacon is automatically sent", () => {
    expect(luxRequests.count()).toEqual(1);
  });

  test("LUX version is included in the beacon", () => {
    expect(parseInt(beacon.searchParams.get("v"))).toBeGreaterThan(200);
  });

  test("customer ID is detected correctly", () => {
    expect(beacon.searchParams.get("id")).toEqual("10001");
  });

  test("page ID and session ID are sent", () => {
    expect(beacon.searchParams.get("sid").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("uid").length).toBeGreaterThan(0);
  });

  test("interaction data is not sent when there are no interactions", () => {
    expect(beacon.searchParams.get("IX")).toBeNull();
  });

  test("CLS is set to zero when there are no layout shifts", () => {
    expect(parseFloat(beacon.searchParams.get("CLS"))).toEqual(0);
  });

  test("hostname and pathname are set", () => {
    expect(beacon.searchParams.get("HN")).toEqual("localhost");
    expect(beacon.searchParams.get("PN")).toEqual(testPage);
  });

  test("CPU stats are sent", () => {
    // There should only be long tasks on the "head-long-tasks" page
    if (testPage === "/head-long-tasks.html") {
      // Total "script" time
      expect(getCpuStat(beacon, "s")).toEqual(110);

      // Number of long tasks
      expect(getCpuStat(beacon, "n")).toEqual(2);

      // Median long task duration
      expect(getCpuStat(beacon, "d")).toEqual(55);

      // Longest long task duration
      expect(getCpuStat(beacon, "x")).toEqual(60);

      // First CPU Idle
      expect(getCpuStat(beacon, "i")).toBeGreaterThan(1);
    } else {
      expect(getCpuStat(beacon, "s")).toEqual(0);
      expect(getCpuStat(beacon, "n")).toEqual(0);
      expect(getCpuStat(beacon, "d")).toEqual(0);
      expect(getCpuStat(beacon, "x")).toEqual(0);
      expect(getCpuStat(beacon, "i")).toBeGreaterThan(1);
    }
  });

  test("page stats are sent", () => {
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
    const viewport = page.viewport();
    expect(getPageStat(beacon, "vh")).toEqual(viewport.height);
    expect(getPageStat(beacon, "vw")).toEqual(viewport.width);
    expect(getPageStat(beacon, "dh")).toEqual(viewport.height);
    expect(getPageStat(beacon, "dw")).toEqual(viewport.width);

    // Document transfer size
    expect(getPageStat(beacon, "ds")).toBeGreaterThan(1);

    // Connection type
    const ct = beacon.searchParams.get("PS")?.match(/ct([^_]+)/) || [];
    expect(ct[1]).toEqual("4G");

    // No errors
    expect(getPageStat(beacon, "er")).toEqual(0);

    // "Normal" navigation type
    expect(getPageStat(beacon, "nt")).toEqual(0);

    // Device memory
    expect(getPageStat(beacon, "dm")).toBeGreaterThan(0);
  });

  test("navigation timing metrics are sent", () => {
    // There should be no redirects for this test page
    expect(getNavTiming(beacon, "rs")).toBeNull();
    expect(getNavTiming(beacon, "re")).toBeNull();

    // Fetch, connect, and DNS times are probably zero for localhost
    expect(getNavTiming(beacon, "fs")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "ds")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "de")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "cs")).toBeGreaterThanOrEqual(0);
    expect(getNavTiming(beacon, "ce")).toBeGreaterThanOrEqual(0);

    // Secure connection time will be null because localhost is insecure
    expect(getNavTiming(beacon, "sc")).toBeNull();

    // Everything else should have be non-zero
    expect(getNavTiming(beacon, "qs")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "bs")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "be")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "ol")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "oi")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "os")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "oe")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "oc")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "ls")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "le")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "sr")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "fc")).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "lc")).toBeGreaterThan(0);
  });

  test("metrics about the lux.js script are sent", () => {
    expect(getLuxJsStat(beacon, "d")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "t")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "f")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "c")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "n")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "e")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "r")).toEqual(100);
    expect(getLuxJsStat(beacon, "x")).toBeGreaterThan(0);
    expect(getLuxJsStat(beacon, "l")).toBeGreaterThan(0);
    expect(getLuxJsStat(beacon, "s")).toBeGreaterThan(0);
  });

  test("interaction metrics are not sent with no interaction", () => {
    expect(beacon.searchParams.get("FID")).toBeNull();
    expect(beacon.searchParams.get("INP")).toBeNull();
    expect(beacon.searchParams.get("IX")).toBeNull();
  });
});
