import { test, expect } from "@playwright/test";
import { entryTypeSupported } from "../helpers/browsers";
import { getCpuStat } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX CPU timing", () => {
  test("detect and report long tasks on the page", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/long-tasks.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const longTasksSupported = await entryTypeSupported(page, "longtask");

    if (longTasksSupported) {
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
    } else {
      expect(beacon.searchParams.get("CPU")).toBeNull();
    }
  });

  test("detect and report early long tasks", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/long-tasks.html?injectBeforeSnippet=createLongTask(100);");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const longTasksSupported = await entryTypeSupported(page, "longtask");

    if (longTasksSupported) {
      expect(getCpuStat(beacon, "s")).toBeGreaterThanOrEqual(150);
    } else {
      expect(beacon.searchParams.get("CPU")).toBeNull();
    }
  });

  test("detect and report early long tasks with no snippet", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/long-tasks.html?noInlineSnippet&injectBeforeSnippet=createLongTask();");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const longTasksSupported = await entryTypeSupported(page, "longtask");

    if (longTasksSupported) {
      const longTaskCount = getCpuStat(beacon, "n");
      const longTaskTotal = getCpuStat(beacon, "s");
      const longTaskMedian = getCpuStat(beacon, "d");
      const longTaskMax = getCpuStat(beacon, "x");

      expect(longTaskCount).toEqual(2);
      expect(longTaskTotal).toBeGreaterThanOrEqual(100);
      expect(longTaskMedian).toBeGreaterThanOrEqual(50);
      expect(longTaskMax).toBeGreaterThanOrEqual(50);
    } else {
      expect(beacon.searchParams.get("CPU")).toBeNull();
    }
  });
});
