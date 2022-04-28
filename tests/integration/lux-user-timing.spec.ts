import { getElapsedMs, parseUserTiming } from "../helpers/lux";

describe("LUX user timing", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  beforeEach(async () => {
    luxRequests.reset();
  });

  test("user timing marks and measures are collected in auto mode", async () => {
    await navigateTo("/user-timing.html");
    const beacon = luxRequests.getUrl(0);
    const UT = parseUserTiming(beacon.searchParams.get("UT"));

    expect(Object.values(UT).length).toEqual(3);
    expect(UT["first-mark"].startTime).toBeGreaterThan(0);
    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(UT["first-mark"].startTime);
    expect(UT["test-measure"].startTime).toEqual(UT["first-mark"].startTime);
    expect(UT["test-measure"].duration).toBeGreaterThan(0);
  });

  test("user timing marks and measures are collected in a SPA", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");

    const timeBeforeMark = await getElapsedMs(page);
    await page.evaluate("performance.mark('test-mark')");
    await page.waitForTimeout(30);
    await page.evaluate("performance.measure('test-measure', 'test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseUserTiming(beacon.searchParams.get("UT"));

    // The mark and measure values will vary from test to test, so there is ~10ms margin of error.
    // To test the mark, we get the current timestamp just before creating the mark. To test the
    // measure, we wait 30ms between the mark and measure, which should make the measure ~30ms.
    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(UT["test-mark"].startTime).toBeLessThan(timeBeforeMark + 10);
    expect(UT["test-measure"].startTime).toEqual(UT["test-mark"].startTime);
    expect(UT["test-measure"].duration).toBeGreaterThanOrEqual(30);
    expect(UT["test-measure"].duration).toBeLessThan(40);
  });

  test("the most recent mark takes priority over previous marks with the same name", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");

    await page.evaluate("performance.mark('test-mark')");
    await page.waitForTimeout(30);
    const timeBeforeMark = await getElapsedMs(page);
    await page.evaluate("performance.mark('test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseUserTiming(beacon.searchParams.get("UT"));

    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(UT["test-mark"].startTime).toBeLessThan(timeBeforeMark + 10);
  });

  test("user timing marks in a SPA are relative to the previous LUX.init call", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");

    await page.evaluate("LUX.send()");
    await page.evaluate("LUX.init()");
    await page.waitForTimeout(30);
    await page.evaluate("performance.mark('test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(1);
    const UT = parseUserTiming(beacon.searchParams.get("UT"));

    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(30);
    expect(UT["test-mark"].startTime).toBeLessThan(40);
  });

  test("global state is not affected by LUX", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");

    await page.evaluate("performance.mark('my-mark')");
    await page.evaluate("performance.measure('my-measure', 'my-mark')");
    await page.evaluate("LUX.send()");
    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.send()");

    expect(await page.evaluate("performance.getEntriesByName('my-mark').length")).toEqual(1);
    expect(await page.evaluate("performance.getEntriesByName('my-measure').length")).toEqual(1);
  });

  test("user timing marks and measures from previous beacons are not included", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");

    await page.evaluate("performance.mark('first-test-mark')");
    await page.evaluate("performance.measure('first-test-measure', 'first-test-mark')");
    await page.evaluate("LUX.send()");
    await page.evaluate("LUX.init()");
    await page.evaluate("performance.mark('second-test-mark')");
    await page.evaluate("performance.measure('second-test-measure', 'second-test-mark')");
    await page.evaluate("LUX.send()");

    const firstUT = parseUserTiming(luxRequests.getUrl(0).searchParams.get("UT"));
    expect(firstUT).toHaveProperty("first-test-mark");
    expect(firstUT).toHaveProperty("first-test-measure");
    expect(firstUT).not.toHaveProperty("second-test-mark");
    expect(firstUT).not.toHaveProperty("second-test-measure");

    const secondUT = parseUserTiming(luxRequests.getUrl(1).searchParams.get("UT"));
    expect(secondUT).not.toHaveProperty("first-test-mark");
    expect(secondUT).not.toHaveProperty("first-test-measure");
    expect(secondUT).toHaveProperty("second-test-mark");
    expect(secondUT).toHaveProperty("second-test-measure");
  });
});
