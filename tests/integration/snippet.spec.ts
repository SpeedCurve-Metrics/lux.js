import { test, expect } from "@playwright/test";
import { END_MARK } from "../../src/constants";
import { referenceErrorMessage } from "../helpers/browsers";
import {
  getNavTiming,
  getNavigationTimingMs,
  getSearchParam,
  parseUserTiming,
} from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX inline snippet", () => {
  test("LUX.markLoadTime works before the script is loaded", async ({ page }) => {
    const beaconRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto(
      "/default.html?injectScript=window.loadTime=performance.now();LUX.markLoadTime();",
      { waitUntil: "networkidle" }
    );

    const beacon = beaconRequests.getUrl(0)!;
    const loadEventStart = getNavTiming(beacon, "le") || 0;
    const loadTime = await page.evaluate(() => window.loadTime as number);
    const loadTimeMark = await page.evaluate(
      (mark) => performance.getEntriesByName(mark)[0].startTime,
      END_MARK
    );

    expect(loadTime).toBeLessThan(loadEventStart);

    /**
     * Calling the snippet's version of markLoadTime() should cause the load time to be marked as
     * the initial call time, as opposed to the time when lux.js processes the command queue and
     * calls its own markLoadTime().
     *
     * We test this by storing the value of performance.now() right before calling markLoadTime(),
     * so the values should be almost exactly the same. These assertions give a bit of leeway to
     * reduce flakiness on slower test machines.
     */
    expect(loadTimeMark).toBeGreaterThanOrEqual(Math.floor(loadTime));
    expect(loadTimeMark).toBeLessThan(loadTime + 5);
  });

  test("LUX.mark works before the script is loaded", async ({ page }) => {
    const beaconRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto(
      `/default.html?injectScript=${[
        "performance.mark = undefined",
        "window.markTime = performance.now()",
        "LUX.mark('mark-1')",
        "LUX.mark('mark-2', { startTime: 200 })",
      ].join(";")}`,
      { waitUntil: "networkidle" }
    );

    const beacon = beaconRequests.getUrl(0)!;
    const markTime = (await page.evaluate(() => window.markTime)) as number;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["mark-1"].startTime).toBeGreaterThanOrEqual(Math.floor(markTime));
    expect(UT["mark-1"].startTime).toBeLessThan(markTime + 5);
    expect(UT["mark-2"].startTime).toEqual(200);
  });

  test("LUX.measure works before the script is loaded", async ({ page }) => {
    const beaconRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto(
      `/default.html?injectScript=${[
        "performance.measure = undefined",
        "window.markTime = performance.now()",
        "LUX.mark('mark-1')",
        "LUX.measure('measure-1', 'mark-1')",
        "LUX.measure('measure-2', undefined, 'connectEnd')",
        "LUX.measure('measure-3', { start: 100, end: 400 })",
        "LUX.measure('measure-4', { end: 400 })",
        "window.beforeMeasureTime = performance.now()",
        "LUX.measure('measure-5', { start: 5 })",
        "LUX.measure('measure-6', { start: 100, duration: 200 })",
      ].join(";")}`,
      { waitUntil: "networkidle" }
    );

    const beacon = beaconRequests.getUrl(0)!;
    const beforeMeasureTime = await page.evaluate(() => window.beforeMeasureTime as number);
    const connectEnd = await getNavigationTimingMs(page, "connectEnd");
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["measure-1"].startTime).toEqual(UT["mark-1"].startTime);

    expect(UT["measure-2"].startTime).toEqual(0);
    expect(UT["measure-2"].duration).toEqual(connectEnd);

    expect(UT["measure-3"].startTime).toEqual(100);
    expect(UT["measure-3"].duration).toEqual(300);

    expect(UT["measure-4"].startTime).toEqual(0);
    expect(UT["measure-4"].duration).toEqual(400);

    expect(UT["measure-5"].startTime).toEqual(5);
    expect(UT["measure-5"].duration).toBeGreaterThanOrEqual(Math.floor(beforeMeasureTime) - 5);
    expect(UT["measure-5"].duration).toBeLessThan(beforeMeasureTime);

    expect(UT["measure-6"].startTime).toEqual(100);
    expect(UT["measure-6"].duration).toEqual(200);
  });

  test("errors that occur before the lux.js script are tracked by the snippet", async ({
    page,
    browserName,
  }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/error/");
    await page.goto("/default.html?injectScript=snippet();", { waitUntil: "networkidle" });

    expect(getSearchParam(errorRequests.getUrl(0)!, "msg")).toContain(
      referenceErrorMessage(browserName, "snippet")
    );
  });
});
