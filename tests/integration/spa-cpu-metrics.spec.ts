import { test, expect } from "@playwright/test";
import { getCpuStat } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX SPA CPU metrics", () => {
  test.skip(
    ({ browserName }) => browserName !== "chromium",
    "Long tasks are only supported in Chromium"
  );

  test("long tasks are only reported for the SPA page they were associated with", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/long-tasks.html?injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    let beacon = luxRequests.getUrl(0)!;
    const longTaskCount = getCpuStat(beacon, "n");
    const longTaskTotal = getCpuStat(beacon, "s");
    const longTaskMedian = getCpuStat(beacon, "d");
    const longTaskMax = getCpuStat(beacon, "x");

    expect(longTaskCount).toEqual(1);
    expect(longTaskTotal).toBeGreaterThan(49);

    // The test page should have one long task, so the median should equal the total
    expect(longTaskMedian).toEqual(longTaskTotal);

    // And the max should equal the total
    expect(longTaskMax).toEqual(longTaskTotal);

    // Initiate a second page view with no long tasks
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.send();
      })
    );

    beacon = luxRequests.getUrl(1)!;

    expect(getCpuStat(beacon, "n")).toEqual(0);

    // Initiate a third page view with long tasks
    await page.evaluate(() => LUX.init());
    await page.locator("#create-long-task").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    beacon = luxRequests.getUrl(2)!;

    expect(getCpuStat(beacon, "n")).toEqual(1);
  });
});
