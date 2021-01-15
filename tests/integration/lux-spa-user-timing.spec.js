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
    await page.waitForTimeout(20);
    await page.evaluate("performance.measure('test-measure', 'test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const userTiming = parseNestedPairs(beacon.searchParams.get("UT"));

    // The mark and measure values will vary from test to test, so there is ~5ms margin of error.
    // To test the mark, we get the current timestamp just before creating the mark. To test the
    // measure, we wait 20ms between the mark and measure, which should make the measure ~20ms.
    expect(parseInt(userTiming["test-mark"])).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(parseInt(userTiming["test-mark"])).toBeLessThan(timeBeforeMark + 5);
    expect(parseInt(userTiming["test-measure"])).toBeGreaterThanOrEqual(20);
    expect(parseInt(userTiming["test-measure"])).toBeLessThan(30);
  });

  test("LUX.mark and LUX.measure work the same as performance.mark and performance.measure", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    const timeBeforeMark = await getElapsedMs(page);
    await page.evaluate("LUX.mark('test-mark')");
    await page.waitForTimeout(20);
    await page.evaluate("LUX.measure('test-measure', 'test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const userTiming = parseNestedPairs(beacon.searchParams.get("UT"));

    // The mark and measure values will vary from test to test, so there is ~5ms margin of error.
    // To test the mark, we get the current timestamp just before creating the mark. To test the
    // measure, we wait 20ms between the mark and measure, which should make the measure ~20ms.
    expect(parseInt(userTiming["test-mark"])).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(parseInt(userTiming["test-mark"])).toBeLessThan(timeBeforeMark + 5);
    expect(parseInt(userTiming["test-measure"])).toBeGreaterThanOrEqual(20);
    expect(parseInt(userTiming["test-measure"])).toBeLessThan(30);
  });

  test("user timing marks are relative to the previous LUX.init call", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    await page.evaluate("LUX.send()");
    await page.evaluate("LUX.init()");
    await page.waitForTimeout(20);
    await page.evaluate("performance.mark('test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(1);
    const userTiming = parseNestedPairs(beacon.searchParams.get("UT"));

    expect(parseInt(userTiming["test-mark"])).toBeGreaterThanOrEqual(20);
    expect(parseInt(userTiming["test-mark"])).toBeLessThan(30);
  });

  test("global state is not affected by LUX", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    await page.evaluate("performance.mark('my-mark')");
    await page.evaluate("performance.measure('my-measure', 'my-mark')");
    await page.evaluate("LUX.send()");
    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.send()");

    expect(await page.evaluate("performance.getEntriesByName('my-mark').length")).toEqual(1);
    expect(await page.evaluate("performance.getEntriesByName('my-measure').length")).toEqual(1);
  });

  test("user timing marks and measures from previous beacons are not included", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");

    await page.evaluate("performance.mark('first-test-mark')");
    await page.evaluate("performance.measure('first-test-measure', 'first-test-mark')");
    await page.evaluate("LUX.send()");
    await page.evaluate("LUX.init()");
    await page.evaluate("performance.mark('second-test-mark')");
    await page.evaluate("performance.measure('second-test-measure', 'second-test-mark')");
    await page.evaluate("LUX.send()");

    const firstUserTiming = parseNestedPairs(luxRequests.getUrl(0).searchParams.get("UT"));
    expect(firstUserTiming).toHaveProperty("first-test-mark");
    expect(firstUserTiming).toHaveProperty("first-test-measure");
    expect(firstUserTiming).not.toHaveProperty("second-test-mark");
    expect(firstUserTiming).not.toHaveProperty("second-test-measure");

    const secondUserTiming = parseNestedPairs(luxRequests.getUrl(1).searchParams.get("UT"));
    expect(secondUserTiming).not.toHaveProperty("first-test-mark");
    expect(secondUserTiming).not.toHaveProperty("first-test-measure");
    expect(secondUserTiming).toHaveProperty("second-test-mark");
    expect(secondUserTiming).toHaveProperty("second-test-measure");
  });
});
