import { getElapsedMs, parseNestedPairs } from "../helpers/lux";

describe("LUX user timing wrappers", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  beforeEach(() => {
    luxRequests.reset();
  });

  describe("LUX.mark() behaves the same as performance.mark()", () => {
    test("LUX.mark(name)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("LUX.mark('lux-mark'); performance.mark('perf-mark')");
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseNestedPairs(beacon.searchParams.get("UT"));

      // Even though we call LUX.mark() and performance.mark() at the same time, a small amount of
      // tolerance in the values prevents the tests from being flaky.
      expect(parseInt(UT["lux-mark"])).toBeGreaterThan(parseInt(UT["perf-mark"]) - 3);
      expect(parseInt(UT["lux-mark"])).toBeLessThan(parseInt(UT["perf-mark"]) + 3);
    });

    test("LUX.mark(name, options)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("LUX.mark('lux-mark', { startTime: 10 })");
      await page.evaluate("performance.mark('perf-mark', { startTime: 10 })");
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseNestedPairs(beacon.searchParams.get("UT"));

      expect(UT["lux-mark"]).toEqual(UT["perf-mark"]);
      expect(parseInt(UT["perf-mark"])).toEqual(10);
    });
  });

  describe("LUX.measure() behaves the same as performance.measure()", () => {
    test("LUX.measure(name)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("LUX.measure('lux-measure'); performance.measure('perf-measure')");
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseNestedPairs(beacon.searchParams.get("UT"));

      expect(parseInt(UT["lux-measure"])).toBeGreaterThan(parseInt(UT["perf-measure"]) - 3);
      expect(parseInt(UT["lux-measure"])).toBeLessThan(parseInt(UT["perf-measure"]) + 3);
    });

    test("LUX.measure(name, startMark)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("performance.mark('start-mark')");
      await page.waitForTimeout(30);
      await page.evaluate(`
        LUX.measure('lux-measure', 'start-mark');
        performance.measure('perf-measure', 'start-mark');
      `);
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseNestedPairs(beacon.searchParams.get("UT"));

      expect(parseInt(UT["lux-measure"])).toBeGreaterThan(parseInt(UT["perf-measure"]) - 3);
      expect(parseInt(UT["lux-measure"])).toBeLessThan(parseInt(UT["perf-measure"]) + 3);
      expect(parseInt(UT["lux-measure"])).toBeGreaterThanOrEqual(30);
    });

    test("LUX.measure(name, startMark, endMark)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("performance.mark('start-mark')");
      await page.waitForTimeout(30);
      await page.evaluate("performance.mark('end-mark')");
      await page.evaluate(`
        LUX.measure('lux-measure', 'start-mark', 'end-mark');
        performance.measure('perf-measure', 'start-mark', 'end-mark');
      `);
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseNestedPairs(beacon.searchParams.get("UT"));

      expect(UT["lux-measure"]).toEqual(UT["perf-measure"]);
      expect(parseInt(UT["lux-measure"])).toBeGreaterThanOrEqual(30);
    });

    test("LUX.measure(name, undefined, endMark)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      const timeBeforeMark = await getElapsedMs(page);
      await page.evaluate("performance.mark('end-mark')");
      await page.evaluate(`
        LUX.measure('lux-measure', undefined, 'end-mark');
        performance.measure('perf-measure', undefined, 'end-mark');
      `);
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseNestedPairs(beacon.searchParams.get("UT"));

      expect(UT["lux-measure"]).toEqual(UT["perf-measure"]);
      expect(parseInt(UT["lux-measure"])).toBeGreaterThanOrEqual(timeBeforeMark);
    });

    test("Calling LUX.measure with an undefined startMark in a SPA uses the last LUX.init call as the start mark", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.waitForTimeout(50);
      await page.evaluate("LUX.send()");
      await page.evaluate("LUX.init()");
      await page.waitForTimeout(30);
      await page.evaluate("LUX.measure('test-measure-1')");
      await page.evaluate("performance.mark('end-mark')");
      await page.evaluate("LUX.measure('test-measure-2', undefined, 'end-mark')");
      await page.evaluate("LUX.measure('test-measure-3', { end: 'end-mark' })");
      await page.evaluate("LUX.send()");

      // Check that the second beacon has a measure relative to the LUX.init call
      const beacon = luxRequests.getUrl(1);
      const UT = parseNestedPairs(beacon.searchParams.get("UT"));

      expect(parseInt(UT["test-measure-1"])).toBeGreaterThanOrEqual(30);
      expect(parseInt(UT["test-measure-1"])).toBeLessThan(40);
      expect(parseInt(UT["test-measure-2"])).toBeGreaterThanOrEqual(30);
      expect(parseInt(UT["test-measure-2"])).toBeLessThan(40);
      expect(parseInt(UT["test-measure-3"])).toBeGreaterThanOrEqual(30);
      expect(parseInt(UT["test-measure-3"])).toBeLessThan(40);
    });

    test("LUX.measure(name, options)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("performance.mark('start-mark')");
      await page.waitForTimeout(30);
      const timeBeforeMark = await getElapsedMs(page);
      await page.evaluate("performance.mark('end-mark')");

      // Equivalent of mark(name, startMark)
      await page.evaluate(`
        LUX.measure('lux-measure-1', { start: 'start-mark' });
        performance.measure('perf-measure-1', { start: 'start-mark' });
      `);

      // Equivalent of mark(name, startMark, endMark)
      await page.evaluate(`
        LUX.measure('lux-measure-2', { start: 'start-mark', end: 'end-mark' });
        performance.measure('perf-measure-2', { start: 'start-mark', end: 'end-mark' });
      `);

      // Equivalent of mark(name, undefined, endMark)
      await page.evaluate(`
        LUX.measure('lux-measure-3', { end: 'end-mark' });
        performance.measure('perf-measure-3', { end: 'end-mark' });
      `);

      // Specifying a duration with a start mark
      await page.evaluate(`
        LUX.measure('lux-measure-4', { start: 'start-mark', duration: 400 });
        performance.measure('perf-measure-4', { start: 'start-mark', duration: 400 });
      `);

      // Specifying a duration with a start mark
      await page.evaluate(`
        LUX.measure('lux-measure-5', { end: 'end-mark', duration: 500 });
        performance.measure('perf-measure-5', { end: 'end-mark', duration: 500 });
      `);

      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseNestedPairs(beacon.searchParams.get("UT"));

      expect(parseInt(UT["lux-measure-1"])).toBeGreaterThan(parseInt(UT["perf-measure-1"]) - 3);
      expect(parseInt(UT["lux-measure-1"])).toBeLessThan(parseInt(UT["perf-measure-1"]) + 3);
      expect(UT["lux-measure-2"]).toEqual(UT["perf-measure-2"]);
      expect(UT["lux-measure-3"]).toEqual(UT["perf-measure-3"]);
      expect(UT["lux-measure-4"]).toEqual(UT["perf-measure-4"]);
      expect(UT["lux-measure-5"]).toEqual(UT["perf-measure-5"]);

      expect(parseInt(UT["lux-measure-1"])).toBeGreaterThanOrEqual(30);
      expect(parseInt(UT["lux-measure-2"])).toBeGreaterThanOrEqual(30);
      expect(parseInt(UT["lux-measure-3"])).toBeGreaterThanOrEqual(timeBeforeMark);
      expect(parseInt(UT["lux-measure-4"])).toEqual(400);
      expect(parseInt(UT["lux-measure-5"])).toEqual(500);
    });
  });
});
