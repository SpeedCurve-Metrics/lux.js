const { extractCondensedValue, getPerformanceTimingMs } = require("../helpers/lux");

describe("LUX SPA", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("https://lux.speedcurve.com/lux/");

  beforeEach(() => {
    luxRequests.reset();
  });

  test("sending a LUX beacon only when LUX.send is called", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    expect(luxRequests.count()).toBe(0);

    await page.evaluate("LUX.send()");
    expect(luxRequests.count()).toBe(1);
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

    expect(luxLoadEventStart).toBe(pageLoadEventStart);
    expect(luxLoadEventEnd).toBe(pageLoadEventEnd);
  });

  test("load time value for subsequent pages is the time between LUX.init() and LUX.send()", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.send()");

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(100);
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(1);
    const navigationTiming = beacon.searchParams.get("NT");
    const loadEventStart = extractCondensedValue(navigationTiming, "ls");
    const loadEventEnd = extractCondensedValue(navigationTiming, "le");

    // We waited 100ms between LUX.init() and LUX.start(), so the load time should
    // be at least 100ms. 120ms is an arbitrary upper limit to make sure we're not
    // over-reporting load time.
    expect(loadEventStart).toBeGreaterThanOrEqual(100);
    expect(loadEventStart).toBeLessThan(120);
    expect(loadEventStart).toEqual(loadEventEnd);
  });
});
