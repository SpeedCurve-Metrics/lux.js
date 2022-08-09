import { getElapsedMs, parseUserTiming } from "../helpers/lux";

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
    const UT = parseUserTiming(beacon.searchParams.get("UT"));
    const nativeEntries = await page.evaluate("performance.getEntriesByName('test-mark')");

    // The mark and measure values will vary from test to test, so there is ~10ms margin of error.
    // To test the mark, we get the current timestamp just before creating the mark.
    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(UT["test-mark"].startTime).toBeLessThan(timeBeforeMark + 10);

    // Double-check that the polyfill was used and not the native implementation
    expect(nativeEntries.length).toEqual(0);
  });

  test("LUX.mark(name, options)", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;performance.mark=undefined;");
    await page.evaluate("LUX.mark('test-mark', { startTime: 10 })");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseUserTiming(beacon.searchParams.get("UT"));
    const nativeEntries = await page.evaluate("performance.getEntriesByName('test-mark')");

    expect(UT["test-mark"].startTime).toEqual(10);
    expect(nativeEntries.length).toEqual(0);
  });

  test("LUX.measure(name)", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;performance.measure=undefined;");
    const timeBeforeMeasure = await getElapsedMs(page);
    await page.evaluate("LUX.measure('test-measure')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseUserTiming(beacon.searchParams.get("UT"));

    expect(UT["test-measure"].startTime).toEqual(0);
    expect(UT["test-measure"].duration).toBeGreaterThanOrEqual(timeBeforeMeasure);
    expect(UT["test-measure"].duration).toBeLessThan(timeBeforeMeasure + 10);
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
    const UT = parseUserTiming(beacon.searchParams.get("UT"));

    expect(UT["test-measure"].startTime).toEqual(UT["start-mark"].startTime);
    expect(UT["test-measure"].duration).toBeGreaterThanOrEqual(30);
    expect(UT["test-measure"].duration).toBeLessThan(40);
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
    const UT = parseUserTiming(beacon.searchParams.get("UT"));

    expect(UT["test-measure"].startTime).toEqual(UT["start-mark"].startTime);
    expect(UT["test-measure"].duration).toEqual(
      UT["end-mark"].startTime - UT["start-mark"].startTime
    );
  });

  test("LUX.measure(name, undefined, endMark)", async () => {
    await navigateTo(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    await page.evaluate("LUX.mark('end-mark')");
    await page.evaluate("LUX.measure('test-measure', undefined, 'end-mark')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseUserTiming(beacon.searchParams.get("UT"));

    expect(UT["test-measure"].startTime).toEqual(0);
    expect(UT["test-measure"].duration).toEqual(UT["end-mark"].startTime);
  });

  test("LUX.measure(name, options)", async () => {
    await navigateTo(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    await page.evaluate("LUX.mark('start-mark')");
    await page.waitForTimeout(30);
    await page.evaluate("LUX.mark('end-mark')");

    const timeBeforeMeasure = await getElapsedMs(page);
    await page.evaluate(`
      // Equivalent of mark(name, startMark)
      LUX.measure('test-measure-1', { start: 'start-mark' });

      // Equivalent of mark(name, startMark, endMark)
      LUX.measure('test-measure-2', { start: 'start-mark', end: 'end-mark' });

      // Equivalent of mark(name, undefined, endMark)
      LUX.measure('test-measure-3', { end: 'end-mark' });

      // Specifying a duration with a start mark
      LUX.measure('test-measure-4', { start: 'start-mark', duration: 400 });

      // Specifying a duration with a start mark
      LUX.measure('test-measure-5', { end: 'end-mark', duration: 500 });

      // Specifying a start timestamp
      LUX.measure('test-measure-6', { start: ${timeBeforeMeasure} });
    `);

    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const UT = parseUserTiming(beacon.searchParams.get("UT"));
    const startMarkTime = UT["start-mark"].startTime;
    const endMarkTime = UT["end-mark"].startTime;

    expect(UT["test-measure-1"].startTime).toEqual(startMarkTime);
    expect(UT["test-measure-1"].duration).toBeGreaterThanOrEqual(timeBeforeMeasure - startMarkTime);
    expect(UT["test-measure-1"].duration).toBeLessThan(timeBeforeMeasure - startMarkTime + 10);

    expect(UT["test-measure-2"].startTime).toEqual(startMarkTime);
    expect(UT["test-measure-2"].duration).toEqual(endMarkTime - startMarkTime);

    expect(UT["test-measure-3"].startTime).toEqual(0);
    expect(UT["test-measure-3"].duration).toEqual(endMarkTime);

    expect(UT["test-measure-4"].startTime).toEqual(startMarkTime);
    expect(UT["test-measure-4"].duration).toEqual(400);

    expect(UT["test-measure-5"].startTime).toEqual(0);
    expect(UT["test-measure-5"].duration).toEqual(500);

    expect(UT["test-measure-6"].startTime).toEqual(timeBeforeMeasure);
  });
});
