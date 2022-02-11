import { getCpuStat } from "../helpers/lux";

describe("LUX CPU timing", () => {
  test("detect and report long tasks on the page", async () => {
    await navigateTo("/long-tasks.html");
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const beacon = luxRequests.getUrl(0);

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
  });

  test("detect and report long tasks that occured before the lux.js script", async () => {
    await navigateTo("/long-tasks.html?noInlineSnippet");
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const beacon = luxRequests.getUrl(0);

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
  });
});
