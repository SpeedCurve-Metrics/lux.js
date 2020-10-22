const { extractCondensedValue } = require("../helpers/lux");

describe("LUX SPA", () => {
  test("sending a LUX beacon only when LUX.send is called", async () => {
    let luxRequests;

    await navigateTo("http://localhost:3000/auto-false.html");
    luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    expect(luxRequests.length).toBe(0);

    await page.evaluate("LUX.send()");
    luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    expect(luxRequests.length).toBe(1);
  });

  test("load time value for the first pages is the time between navigationStart and loadEventStart", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.send()");
    const luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    const beacon = new URL(luxRequests[0].url());
    const navigationTiming = beacon.searchParams.get("NT");
    const luxLoadTime = extractCondensedValue(navigationTiming, "ls");
    const navigationStart = await page.evaluate("performance.timing.navigationStart");
    const loadEventStart = await page.evaluate("performance.timing.loadEventStart");

    expect(luxLoadTime).toBe(loadEventStart - navigationStart);
  });

  test("load time value for subsequent pages is the time between LUX.init() and LUX.send()", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.send()");

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(500);
    await page.evaluate("LUX.send()");

    const luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    const beacon = new URL(luxRequests[1].url());
    const navigationTiming = beacon.searchParams.get("NT");
    const loadEventStart = extractCondensedValue(navigationTiming, "ls");

    // We waited 500ms between LUX.init() and LUX.start(), so the load time should
    // be at least 500ms. 550ms is an arbitrary upper limit to make sure we're not
    // over-reporting load time.
    expect(loadEventStart).toBeGreaterThan(500);
    expect(loadEventStart).toBeLessThan(550);
  });
});
