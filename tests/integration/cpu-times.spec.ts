import { test, expect } from "@playwright/test";
import { getCpuStat } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX CPU timing", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Long tasks are only supported in Chromium",
  );

  test("detect and report long tasks on the page", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/long-tasks.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    const longTaskCount = getCpuStat(beacon, "n");
    const longTaskTotal = getCpuStat(beacon, "s");
    const longTaskMedian = getCpuStat(beacon, "d");
    const longTaskMax = getCpuStat(beacon, "x");

    expect(longTaskCount).toEqual(1);
    expect(longTaskTotal).toBeGreaterThanOrEqual(50);

    // The test page should have one long task, so the median should equal the total
    expect(longTaskMedian).toEqual(longTaskTotal);

    // And the max should equal the total
    expect(longTaskMax).toEqual(longTaskTotal);
  });

  test("detect and report early long tasks", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/long-tasks.html?injectBeforeSnippet=createLongTask(100);");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(getCpuStat(beacon, "s")).toBeGreaterThanOrEqual(150);
  });

  test("detect and report early long tasks with no snippet", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/long-tasks.html?noInlineSnippet&injectBeforeSnippet=createLongTask();");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    const longTaskCount = getCpuStat(beacon, "n");
    const longTaskTotal = getCpuStat(beacon, "s");
    const longTaskMedian = getCpuStat(beacon, "d");
    const longTaskMax = getCpuStat(beacon, "x");

    expect(longTaskCount).toEqual(1);
    expect(longTaskTotal).toBeGreaterThanOrEqual(50);

    // The test page should have one long task, so the median should equal the total
    expect(longTaskMedian).toEqual(longTaskTotal);

    // And the max should equal the total
    expect(longTaskMax).toEqual(longTaskTotal);
  });
});
