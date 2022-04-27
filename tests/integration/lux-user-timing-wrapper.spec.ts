import { getElapsedMs, parseUserTiming } from "../helpers/lux";

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
      const UT = parseUserTiming(beacon.searchParams.get("UT"));

      // Even though we call LUX.mark() and performance.mark() at the same time, a small amount of
      // tolerance in the values prevents the tests from being flaky.
      expect(UT["lux-mark"].startTime).toBeGreaterThan(UT["perf-mark"].startTime - 3);
      expect(UT["lux-mark"].startTime).toBeLessThan(UT["perf-mark"].startTime + 3);
    });

    test("LUX.mark(name, options)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("LUX.mark('lux-mark', { startTime: 10 })");
      await page.evaluate("performance.mark('perf-mark', { startTime: 10 })");
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseUserTiming(beacon.searchParams.get("UT"));

      expect(UT["lux-mark"].startTime).toEqual(UT["perf-mark"].startTime);
      expect(UT["perf-mark"].startTime).toEqual(10);
    });
  });

  describe("LUX.measure() behaves the same as performance.measure()", () => {
    test("LUX.measure(name)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("LUX.measure('lux-measure'); performance.measure('perf-measure')");
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseUserTiming(beacon.searchParams.get("UT"));

      expect(UT["lux-measure"].startTime).toBeGreaterThan(UT["perf-measure"].startTime - 3);
      expect(UT["lux-measure"].startTime).toBeLessThan(UT["perf-measure"].startTime + 3);
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
      const UT = parseUserTiming(beacon.searchParams.get("UT"));

      expect(UT["lux-measure"].startTime).toEqual(UT["perf-measure"].startTime);
      expect(UT["lux-measure"].duration).toBeGreaterThan(UT["perf-measure"].duration - 3);
      expect(UT["lux-measure"].duration).toBeLessThan(UT["perf-measure"].duration + 3);
      expect(UT["lux-measure"].duration).toBeGreaterThanOrEqual(30);
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
      const UT = parseUserTiming(beacon.searchParams.get("UT"));

      expect(UT["lux-measure"].startTime).toEqual(UT["perf-measure"].startTime);
      expect(UT["lux-measure"].duration).toEqual(UT["perf-measure"].duration);
      expect(UT["lux-measure"].duration).toBeGreaterThanOrEqual(30);
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
      const UT = parseUserTiming(beacon.searchParams.get("UT"));
      const endMarkTime = UT["end-mark"].startTime;

      expect(UT["lux-measure"].startTime).toEqual(UT["perf-measure"].startTime);
      expect(UT["lux-measure"].duration).toEqual(UT["perf-measure"].duration);
      expect(UT["lux-measure"].duration).toEqual(endMarkTime);
      expect(endMarkTime).toBeGreaterThanOrEqual(timeBeforeMark);
      expect(endMarkTime).toBeLessThan(timeBeforeMark + 10);
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
      const UT = parseUserTiming(beacon.searchParams.get("UT"));
      const endMarkTime = UT["end-mark"].startTime;

      expect(UT["test-measure-1"].startTime).toEqual(0);
      expect(UT["test-measure-1"].duration).toBeGreaterThanOrEqual(30);
      expect(UT["test-measure-1"].duration).toBeLessThan(40);

      expect(UT["test-measure-2"].startTime).toEqual(0);
      expect(UT["test-measure-2"].duration).toEqual(endMarkTime);

      expect(UT["test-measure-3"].startTime).toEqual(0);
      expect(UT["test-measure-3"].duration).toEqual(endMarkTime);
    });

    test("LUX.measure(name, options)", async () => {
      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("performance.mark('start-mark')");
      await page.waitForTimeout(30);
      const timeBeforeMark = await getElapsedMs(page);
      await page.evaluate("performance.mark('end-mark')");

      await page.evaluate(`
        // Equivalent of mark(name, startMark)
        LUX.measure('lux-measure-1', { start: 'start-mark' });
        performance.measure('perf-measure-1', { start: 'start-mark' });

        // Equivalent of mark(name, startMark, endMark)
        LUX.measure('lux-measure-2', { start: 'start-mark', end: 'end-mark' });
        performance.measure('perf-measure-2', { start: 'start-mark', end: 'end-mark' });

        // Equivalent of mark(name, undefined, endMark)
        LUX.measure('lux-measure-3', { end: 'end-mark' });
        performance.measure('perf-measure-3', { end: 'end-mark' });

        // Specifying a duration with a start mark
        LUX.measure('lux-measure-4', { start: 'start-mark', duration: 400 });
        performance.measure('perf-measure-4', { start: 'start-mark', duration: 400 });

        // Specifying a duration with a start mark
        LUX.measure('lux-measure-5', { end: 'end-mark', duration: 500 });
        performance.measure('perf-measure-5', { end: 'end-mark', duration: 500 });
      `);

      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      const UT = parseUserTiming(beacon.searchParams.get("UT"));

      expect(UT["lux-measure-1"].startTime).toEqual(UT["perf-measure-2"].startTime);
      expect(UT["lux-measure-1"].duration).toBeGreaterThan(UT["perf-measure-1"].duration - 3);
      expect(UT["lux-measure-1"].duration).toBeLessThan(UT["perf-measure-1"].duration + 3);
      expect(UT["lux-measure-2"].startTime).toEqual(UT["perf-measure-2"].startTime);
      expect(UT["lux-measure-2"].duration).toEqual(UT["perf-measure-2"].duration);
      expect(UT["lux-measure-3"].startTime).toEqual(UT["perf-measure-3"].startTime);
      expect(UT["lux-measure-3"].duration).toEqual(UT["perf-measure-3"].duration);
      expect(UT["lux-measure-4"].startTime).toEqual(UT["perf-measure-4"].startTime);
      expect(UT["lux-measure-4"].duration).toEqual(UT["perf-measure-4"].duration);
      expect(UT["lux-measure-5"].startTime).toEqual(UT["perf-measure-5"].startTime);
      expect(UT["lux-measure-5"].duration).toEqual(UT["perf-measure-5"].duration);

      expect(UT["lux-measure-1"].duration).toBeGreaterThanOrEqual(30);
      expect(UT["lux-measure-2"].duration).toBeGreaterThanOrEqual(30);
      expect(UT["lux-measure-3"].duration).toBeGreaterThanOrEqual(timeBeforeMark);
      expect(UT["lux-measure-4"].duration).toEqual(400);
      expect(UT["lux-measure-5"].duration).toEqual(500);
    });
  });
});
