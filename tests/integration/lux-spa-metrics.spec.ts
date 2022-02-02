import { extractCondensedValue, getPerformanceTimingMs } from "../helpers/lux";
import Flags, { hasFlag } from "../../src/flags";

describe("LUX SPA", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  beforeEach(() => {
    luxRequests.reset();
  });

  test("sending a LUX beacon only when LUX.send is called", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    expect(luxRequests.count()).toEqual(0);

    await page.evaluate("LUX.send()");
    expect(luxRequests.count()).toEqual(1);
  });

  test("regular page metrics are sent for the first SPA page view", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const navTiming = beacon.searchParams.get("NT");
    const pageStats = beacon.searchParams.get("PS");

    // Paint metrics
    expect(extractCondensedValue(navTiming, "sr")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "fc")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "lc")).toBeGreaterThan(0);

    // Page stats
    expect(extractCondensedValue(pageStats, "ns")).toEqual(1);
    expect(extractCondensedValue(pageStats, "ss")).toEqual(0);

    // Viewport stats
    const viewport = page.viewport();
    expect(extractCondensedValue(pageStats, "vh")).toEqual(viewport.height);
    expect(extractCondensedValue(pageStats, "vw")).toEqual(viewport.width);
  });

  test("calling LUX.init before LUX.send does not lose data", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const navTiming = beacon.searchParams.get("NT");

    expect(extractCondensedValue(navTiming, "sr")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "fc")).toBeGreaterThan(0);
    expect(extractCondensedValue(navTiming, "lc")).toBeGreaterThan(0);
  });

  test("load time value for the first pages is the time between navigationStart and loadEventStart", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.send()");
    const beacon = luxRequests.getUrl(0);
    const navigationTiming = beacon.searchParams.get("NT");
    const luxLoadEventStart = extractCondensedValue(navigationTiming, "ls");
    const luxLoadEventEnd = extractCondensedValue(navigationTiming, "ls");
    const pageLoadEventStart = await getPerformanceTimingMs(page, "loadEventStart");
    const pageLoadEventEnd = await getPerformanceTimingMs(page, "loadEventEnd");

    expect(luxLoadEventStart).toEqual(pageLoadEventStart);
    expect(luxLoadEventEnd).toEqual(pageLoadEventEnd);
  });

  test("load time value for subsequent pages is the time between LUX.init() and LUX.send()", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.send()");

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(50);
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(1);
    const navigationTiming = beacon.searchParams.get("NT");
    const loadEventStart = extractCondensedValue(navigationTiming, "ls");
    const loadEventEnd = extractCondensedValue(navigationTiming, "le");

    // We waited 50ms between LUX.init() and LUX.send(), so the load time should
    // be at least 50ms. 60ms is an arbitrary upper limit to make sure we're not
    // over-reporting load time.
    expect(loadEventStart).toBeGreaterThanOrEqual(20);
    expect(loadEventStart).toBeLessThan(60);
    expect(loadEventStart).toEqual(loadEventEnd);

    // Check that the InitCalled flag was set
    const beaconFlags = parseInt(beacon.searchParams.get("fl"), 10);

    expect(hasFlag(beaconFlags, Flags.InitCalled)).toBe(true);
  });

  test("load time can be marked before the beacon is sent", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.send()");

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(10);
    // await page.evaluate("LUX.markLoadTime()");
    await page.waitForTimeout(50);
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const navigationTiming = beacon.searchParams.get("NT");
    const loadEventStart = extractCondensedValue(navigationTiming, "ls");

    expect(loadEventStart).toBeGreaterThan(10);
    expect(loadEventStart).toBeLessThan(50);
  });
});
