const { parseNestedPairs, getElapsedMs } = require("../helpers/lux");

describe("LUX SPA user timing", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("https://lux.speedcurve.com/lux/");

  beforeEach(() => {
    luxRequests.reset();
  });

  test("user timing marks and measures are recorded", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    const timeBeforeMark = await getElapsedMs(page);
    await page.evaluate("performance.mark('test-mark')");
    await page.waitForTimeout(100);
    await page.evaluate("performance.measure('test-measure', 'test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const userTiming = parseNestedPairs(beacon.searchParams.get("UT"));

    // The mark and measure values will vary from test to test, so there is ~20ms margin of error.
    // To test the mark, we get the current timestamp just before creating the mark. To test the
    // measure, we wait 100ms between the mark and measure, which should make the measure ~100ms.
    expect(parseInt(userTiming["test-mark"])).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(parseInt(userTiming["test-mark"])).toBeLessThan(timeBeforeMark + 20);
    expect(parseInt(userTiming["test-measure"])).toBeGreaterThanOrEqual(100);
    expect(parseInt(userTiming["test-measure"])).toBeLessThan(120);
  });

  test("user timing marks are relative to the previous LUX.init call", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    await page.evaluate("LUX.send()");
    await page.evaluate("LUX.init()");
    await page.waitForTimeout(100);
    await page.evaluate("performance.mark('test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(1);
    const userTiming = parseNestedPairs(beacon.searchParams.get("UT"));

    expect(parseInt(userTiming["test-mark"])).toBeGreaterThanOrEqual(100);
    expect(parseInt(userTiming["test-mark"])).toBeLessThan(120);
  });
});
