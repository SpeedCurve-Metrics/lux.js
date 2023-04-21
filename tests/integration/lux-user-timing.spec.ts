import { test, expect } from "@playwright/test";
import { getElapsedMs, getSearchParam, parseUserTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX user timing", () => {
  test("user timing marks and measures are collected in auto mode", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/user-timing.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(Object.values(UT).length).toEqual(3);
    expect(UT["first-mark"].startTime).toBeGreaterThan(0);
    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(UT["first-mark"].startTime);
    expect(UT["test-measure"].startTime).toEqual(UT["first-mark"].startTime);
    expect(UT["test-measure"].duration).toBeGreaterThan(0);
  });

  test("user timing marks and measures are collected in a SPA", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });

    const timeBeforeMark = await getElapsedMs(page);
    await page.evaluate(() => performance.mark("test-mark"));
    const timeAfterMark = await getElapsedMs(page);
    await page.waitForTimeout(30);
    await page.evaluate(() => performance.measure("test-measure", "test-mark"));
    const timeAfterMeasure = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(UT["test-mark"].startTime).toBeLessThan(timeAfterMark);
    expect(UT["test-measure"].startTime).toEqual(UT["test-mark"].startTime);
    expect(UT["test-measure"].duration).toBeGreaterThanOrEqual(30);
    expect(UT["test-measure"].duration).toBeLessThan(timeAfterMeasure - UT["test-mark"].startTime);
  });

  test("the most recent mark takes priority over previous marks with the same name", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });

    await page.evaluate(() => performance.mark("test-mark"));
    await page.waitForTimeout(30);
    const timeBeforeMark = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        performance.mark("test-mark");
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(timeBeforeMark);
    expect(UT["test-mark"].startTime).toBeLessThan(timeBeforeMark + 10);
  });

  test("user timing marks in a SPA are relative to the previous LUX.init call", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });

    await page.evaluate(() => LUX.send());
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(30);
    await page.evaluate(() => performance.mark("test-mark"));
    const timeAfterMark = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(1)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(UT["test-mark"].startTime).toBeGreaterThanOrEqual(30);
    expect(UT["test-mark"].startTime).toBeLessThan(timeAfterMark);
  });

  test("global state is not affected by LUX", async ({ page }) => {
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });

    await page.evaluate(() => {
      performance.mark("my-mark");
      performance.measure("my-measure", "my-mark");
      LUX.send();
      LUX.init();
      LUX.send();
    });

    expect(await page.evaluate(() => performance.getEntriesByName("my-mark").length)).toEqual(1);
    expect(await page.evaluate(() => performance.getEntriesByName("my-measure").length)).toEqual(1);
  });

  test("user timing marks and measures from previous beacons are not included", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        performance.mark("first-test-mark");
        performance.measure("first-test-measure", "first-test-mark");
        LUX.send();
      })
    );

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        performance.mark("second-test-mark");
        performance.measure("second-test-measure", "second-test-mark");
        LUX.send();
      })
    );

    const firstUT = parseUserTiming(getSearchParam(luxRequests.getUrl(0)!, "UT"));
    expect(firstUT).toHaveProperty("first-test-mark");
    expect(firstUT).toHaveProperty("first-test-measure");
    expect(firstUT).not.toHaveProperty("second-test-mark");
    expect(firstUT).not.toHaveProperty("second-test-measure");

    const secondUT = parseUserTiming(getSearchParam(luxRequests.getUrl(1)!, "UT"));
    expect(secondUT).not.toHaveProperty("first-test-mark");
    expect(secondUT).not.toHaveProperty("first-test-measure");
    expect(secondUT).toHaveProperty("second-test-mark");
    expect(secondUT).toHaveProperty("second-test-measure");
  });
});
