import { getElapsedMs, parseNestedPairs } from "../helpers/lux";

describe("LUX user timing polyfills", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  beforeEach(async () => {
    luxRequests.reset();
  });

  test("LUX.mark(name)", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;performance.mark=undefined;");
    const timeBeforeMark = await getElapsedMs(page);
    await page.evaluate("LUX.mark('test-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseNestedPairs(beacon.searchParams.get("UT"));
    const nativeEntries = await page.evaluate("performance.getEntriesByName('test-mark')");

    // The mark and measure values will vary from test to test, so there is ~10ms margin of error.
    // To test the mark, we get the current timestamp just before creating the mark.
    expect(parseInt(UT["test-mark"])).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(parseInt(UT["test-mark"])).toBeLessThan(timeBeforeMark + 10);

    // Double-check that the polyfill was used and not the native implementation
    expect(nativeEntries.length).toEqual(0);
  });

  test("LUX.mark(name, options)", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;performance.mark=undefined;");
    await page.evaluate("LUX.mark('test-mark', { startTime: 10 })");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseNestedPairs(beacon.searchParams.get("UT"));
    const nativeEntries = await page.evaluate("performance.getEntriesByName('test-mark')");

    expect(parseInt(UT["test-mark"])).toEqual(10);
    expect(nativeEntries.length).toEqual(0);
  });

  test("LUX.measure(name)", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;performance.measure=undefined;");
    const timeBeforeMeasure = await getElapsedMs(page);
    await page.evaluate("LUX.measure('test-measure')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseNestedPairs(beacon.searchParams.get("UT"));

    expect(parseInt(UT["test-measure"])).toBeGreaterThanOrEqual(timeBeforeMeasure);
    expect(parseInt(UT["test-measure"])).toBeLessThan(timeBeforeMeasure + 10);
  });

  test("LUX.measure(name, startMark)", async () => {
    await navigateTo(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    await page.evaluate("LUX.mark('start-mark')");
    await page.waitForTimeout(30);
    await page.evaluate("LUX.measure('test-measure', 'start-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseNestedPairs(beacon.searchParams.get("UT"));

    expect(parseInt(UT["test-measure"])).toBeGreaterThanOrEqual(30);
    expect(parseInt(UT["test-measure"])).toBeLessThan(40);
  });

  test("LUX.measure(name, startMark, endMark)", async () => {
    await navigateTo(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    await page.evaluate("LUX.mark('start-mark')");
    await page.waitForTimeout(30);
    await page.evaluate("LUX.mark('end-mark')");
    await page.evaluate("LUX.measure('test-measure', 'start-mark', 'end-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseNestedPairs(beacon.searchParams.get("UT"));

    expect(parseInt(UT["test-measure"])).toBeGreaterThanOrEqual(30);
    expect(parseInt(UT["test-measure"])).toBeLessThan(40);
  });

  test("LUX.measure(name, undefined, endMark)", async () => {
    await navigateTo(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    const timeBeforeMark = await getElapsedMs(page);
    await page.evaluate("LUX.mark('end-mark')");
    await page.evaluate("LUX.measure('test-measure', undefined, 'end-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseNestedPairs(beacon.searchParams.get("UT"));

    expect(parseInt(UT["test-measure"])).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(parseInt(UT["test-measure"])).toBeLessThan(timeBeforeMark + 10);
  });

  test("LUX.measure(name, options)", async () => {
    await navigateTo(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    await page.evaluate("LUX.mark('start-mark')");
    await page.waitForTimeout(30);
    const timeBeforeMark = await getElapsedMs(page);
    await page.evaluate("LUX.mark('end-mark')");

    // Equivalent of mark(name, startMark)
    await page.evaluate("LUX.measure('test-measure-1', { start: 'start-mark' })");

    // Equivalent of mark(name, startMark, endMark)
    await page.evaluate("LUX.measure('test-measure-2', { start: 'start-mark', end: 'end-mark' })");

    // Equivalent of mark(name, undefined, endMark)
    await page.evaluate("LUX.measure('test-measure-3', { end: 'end-mark' })");

    // Specifying a duration with a start mark
    await page.evaluate("LUX.measure('test-measure-4', { start: 'start-mark', duration: 400 })");

    // Specifying a duration with a start mark
    await page.evaluate("LUX.measure('test-measure-5', { end: 'end-mark', duration: 500 })");

    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseNestedPairs(beacon.searchParams.get("UT"));

    expect(parseInt(UT["test-measure-1"])).toBeGreaterThanOrEqual(30);
    expect(parseInt(UT["test-measure-1"])).toBeLessThan(40);
    expect(parseInt(UT["test-measure-2"])).toBeGreaterThanOrEqual(30);
    expect(parseInt(UT["test-measure-2"])).toBeLessThan(40);
    expect(parseInt(UT["test-measure-3"])).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(parseInt(UT["test-measure-3"])).toBeLessThan(timeBeforeMark + 10);
    expect(parseInt(UT["test-measure-4"])).toEqual(400);
    expect(parseInt(UT["test-measure-5"])).toEqual(500);
  });
});
