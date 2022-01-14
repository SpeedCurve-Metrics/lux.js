import { extractCondensedValue, parseNestedPairs } from "../helpers/lux";

const testPages = [
  ["default configuration", "default.html"],
  ["default configuration with early longtasks", "default-with-snippet-longtasks.html"],
];

describe.each(testPages)("%s", (_, testPage) => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
  let beacon: URL;

  beforeAll(async () => {
    luxRequests.reset();
    await navigateTo(`http://localhost:3000/${testPage}`);
    beacon = luxRequests.getUrl(0);
  });

  test("LUX beacon is automatically sent", () => {
    expect(luxRequests.count()).toEqual(1);
  });

  test("LUX version is included in the beacon", () => {
    expect(parseInt(beacon.searchParams.get("v"), 10)).toBeGreaterThan(200);
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

  test("hostname and pathname are set, with pathname as the last query parameter", () => {
    expect(beacon.searchParams.get("HN")).toEqual("localhost");
    expect(beacon.searchParams.get("PN")).toEqual(`/${testPage}`);
    expect([...beacon.searchParams.entries()].pop()).toEqual(["PN", `/${testPage}`]);
  });

  test("CPU stats are sent", () => {
    const cpuStats = parseNestedPairs(beacon.searchParams.get("CPU"));

    // There should only be long tasks on the "default-with-snippet-longtasks" page
    if (testPage === "default-with-snippet-longtasks.html") {
      // Total "script" time
      expect(parseInt(cpuStats.s, 10)).toEqual(110);

      // Number of long tasks
      expect(parseInt(cpuStats.n, 10)).toEqual(2);

      // Median long task duration
      expect(parseInt(cpuStats.d, 10)).toEqual(55);

      // Longest long task duration
      expect(parseInt(cpuStats.x, 10)).toEqual(60);

      // First CPU Idle
      expect(parseInt(cpuStats.i, 10)).toBeGreaterThan(1);
    } else {
      expect(parseInt(cpuStats.s, 10)).toEqual(0);
      expect(parseInt(cpuStats.n, 10)).toEqual(0);
      expect(parseInt(cpuStats.d, 10)).toEqual(0);
      expect(parseInt(cpuStats.x, 10)).toEqual(0);
      expect(parseInt(cpuStats.i, 10)).toBeGreaterThan(1);
    }
  });

  test("page stats are sent", () => {
    const pageStats = beacon.searchParams.get("PS");

    // There is a single external script: lux.js.
    expect(extractCondensedValue(pageStats, "ns")).toEqual(1);

    // No blocking scripts
    expect(extractCondensedValue(pageStats, "bs")).toEqual(0);

    // The LUX inline script
    expect(extractCondensedValue(pageStats, "is")).toBeGreaterThan(0);

    // No stylesheets
    expect(extractCondensedValue(pageStats, "ss")).toEqual(0);
    expect(extractCondensedValue(pageStats, "bc")).toEqual(0);
    expect(extractCondensedValue(pageStats, "ic")).toEqual(0);

    // No images
    expect(extractCondensedValue(pageStats, "ia")).toEqual(0);
    expect(extractCondensedValue(pageStats, "it")).toEqual(0);

    // DOM depth and number of DOM elements
    expect(extractCondensedValue(pageStats, "dd")).toBeGreaterThan(1);
    expect(extractCondensedValue(pageStats, "nd")).toBeGreaterThan(1);

    // Viewport info
    const viewport = page.viewport();
    expect(extractCondensedValue(pageStats, "vh")).toEqual(viewport.height);
    expect(extractCondensedValue(pageStats, "vw")).toEqual(viewport.width);
    expect(extractCondensedValue(pageStats, "dh")).toEqual(viewport.height);
    expect(extractCondensedValue(pageStats, "dw")).toEqual(viewport.width);

    // Document transfer size
    expect(extractCondensedValue(pageStats, "ds")).toBeGreaterThan(1);

    // Connection type
    const ct = pageStats?.match(/ct([^_]+)/) || [];
    expect(ct[1]).toEqual("4G");

    // No errors
    expect(extractCondensedValue(pageStats, "er")).toEqual(0);

    // "Normal" navigation type
    expect(extractCondensedValue(pageStats, "nt")).toEqual(0);

    // Device memory
    expect(extractCondensedValue(pageStats, "dm")).toBeGreaterThan(0);
  });

  test("navigation timing metrics are sent", () => {
    const navTiming = beacon.searchParams.get("NT");

    expect(navTiming?.length).toBeGreaterThan(0);

    // There should be no redirects for this test page
    expect(extractCondensedValue(navTiming, "rs")).toBeNull();
    expect(extractCondensedValue(navTiming, "re")).toBeNull();

    // Fetch, connect, and DNS times are probably zero for localhost
    expect(extractCondensedValue(navTiming, "fs")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(navTiming, "ds")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(navTiming, "de")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(navTiming, "cs")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(navTiming, "ce")).toBeGreaterThanOrEqual(0);

    // Secure connection time will be null because localhost is insecure
    expect(extractCondensedValue(navTiming, "sc")).toBeNull();

    // Everything else should have be non-zero
    expect(extractCondensedValue(navTiming, "qs")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "bs")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "be")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "ol")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "oi")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "os")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "oe")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "oc")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "ls")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "le")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "sr")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "fc")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "lc")).toBeGreaterThan(0);
  });

  test("metrics about the lux.js script are sent", () => {
    const LJS = beacon.searchParams.get("LJS");

    expect(LJS.length).toBeGreaterThan(0);
    expect(extractCondensedValue(LJS, "d")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(LJS, "t")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(LJS, "f")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(LJS, "c")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(LJS, "n")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(LJS, "e")).toBeGreaterThanOrEqual(0);
    expect(extractCondensedValue(LJS, "r")).toEqual(100);
    expect(extractCondensedValue(LJS, "x")).toBeGreaterThan(0);
    expect(extractCondensedValue(LJS, "l")).toBeGreaterThan(0);
    expect(extractCondensedValue(LJS, "s")).toBeGreaterThan(0);
  });
});
