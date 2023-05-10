import { test, expect } from "@playwright/test";
import { getElapsedMs, getSearchParam, parseUserTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX user timing polyfills", () => {
  test("LUX.mark(name)", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;performance.mark=undefined;");
    const timeBeforeMark = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.mark("test-mark");
        LUX.send();
      })
    );
    const timeAfterMark = await getElapsedMs(page);

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));
    const nativeEntries = await page.evaluate(() => performance.getEntriesByName("test-mark"));

    // The mark and measure values will vary from test to test, so there is ~10ms margin of error.
    // To test the mark, we get the current timestamp just before creating the mark.
    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(UT["test-mark"].startTime).toBeLessThanOrEqual(timeAfterMark);

    // Double-check that the polyfill was used and not the native implementation
    expect(nativeEntries.length).toEqual(0);
  });

  test("LUX.mark(name, options)", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;performance.mark=undefined;");
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.mark("test-mark", { startTime: 10 });
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));
    const nativeEntries = await page.evaluate(() => performance.getEntriesByName("test-mark"));

    expect(UT["test-mark"].startTime).toEqual(10);
    expect(nativeEntries.length).toEqual(0);
  });

  test("LUX.measure(name)", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;performance.measure=undefined;");
    const timeBeforeMeasure = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.measure("test-measure");
        LUX.send();
      })
    );
    const timeAfterMeasure = await getElapsedMs(page);

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["test-measure"].startTime).toEqual(0);
    expect(UT["test-measure"].duration).toBeGreaterThanOrEqual(timeBeforeMeasure);
    expect(UT["test-measure"].duration).toBeLessThanOrEqual(timeAfterMeasure);
  });

  test("LUX.measure(name, startMark)", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    const timeBeforeStartMark = await getElapsedMs(page);
    await page.evaluate(() => LUX.mark("start-mark"));
    await page.waitForTimeout(30);
    await page.evaluate(() => LUX.measure("test-measure", "start-mark"));
    const timeAfterMeasure = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["test-measure"].startTime).toEqual(UT["start-mark"].startTime);
    expect(UT["test-measure"].duration).toBeGreaterThanOrEqual(30);
    expect(UT["test-measure"].duration).toBeLessThanOrEqual(timeAfterMeasure - timeBeforeStartMark);
  });

  test("LUX.measure(name, startMark, endMark)", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    await page.evaluate(() => LUX.mark("start-mark"));
    await page.waitForTimeout(20);
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.mark("end-mark");
        LUX.measure("test-measure", "start-mark", "end-mark");
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["test-measure"].startTime).toEqual(UT["start-mark"].startTime);
    expect(UT["test-measure"].duration).toEqual(
      UT["end-mark"].startTime - UT["start-mark"].startTime
    );
  });

  test("LUX.measure(name, undefined, endMark)", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.mark("end-mark");
        LUX.measure("test-measure", undefined, "end-mark");
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["test-measure"].startTime).toEqual(0);
    expect(UT["test-measure"].duration).toEqual(UT["end-mark"].startTime);
  });

  test("LUX.measure(name, options)", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.auto=false;performance.mark=undefined;performance.measure=undefined;"
    );

    const timeBeforeStartMark = await getElapsedMs(page);
    await page.evaluate(() => LUX.mark("start-mark"));
    await page.waitForTimeout(30);
    await page.evaluate(() => LUX.mark("end-mark"));

    const timeBeforeMeasure = await getElapsedMs(page);
    await page.evaluate((timeBeforeMeasure) => {
      // Equivalent of mark(name, startMark)
      LUX.measure("test-measure-1", { start: "start-mark" });

      // Equivalent of mark(name, startMark, endMark)
      LUX.measure("test-measure-2", { start: "start-mark", end: "end-mark" });

      // Equivalent of mark(name, undefined, endMark)
      LUX.measure("test-measure-3", { end: "end-mark" });

      // Specifying a duration with a start mark
      LUX.measure("test-measure-4", { start: "start-mark", duration: 400 });

      // Specifying a duration with a start mark
      LUX.measure("test-measure-5", { end: "end-mark", duration: 500 });

      // Specifying a start timestamp
      LUX.measure("test-measure-6", { start: timeBeforeMeasure });
    }, timeBeforeMeasure);
    const timeAfterMeasure = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));
    const startMarkTime = UT["start-mark"].startTime;
    const endMarkTime = UT["end-mark"].startTime;

    expect(UT["test-measure-1"].startTime).toEqual(startMarkTime);
    expect(UT["test-measure-1"].duration).toBeGreaterThanOrEqual(timeBeforeMeasure - startMarkTime);
    expect(UT["test-measure-1"].duration).toBeLessThanOrEqual(
      timeAfterMeasure - timeBeforeStartMark
    );

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
