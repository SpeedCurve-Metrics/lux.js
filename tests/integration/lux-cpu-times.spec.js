const { parseNestedPairs } = require("../helpers/lux");

describe("LUX CPU timing", () => {
  test("detect and report long tasks on the page", async () => {
    await navigateTo("http://localhost:3000/default-with-cpu.html");
    const luxRequests = requestInterceptor.createRequestMatcher("https://lux.speedcurve.com/lux/");
    const beacon = luxRequests.getUrl(0);
    const cpuMetrics = parseNestedPairs(beacon.searchParams.get("CPU"));

    expect(parseInt(cpuMetrics.n, 10)).toEqual(1);
    expect(parseInt(cpuMetrics.s, 10)).toBeGreaterThan(49);

    // The test page should have one long task, so the median should equal the total
    expect(cpuMetrics.d).toEqual(cpuMetrics.s);

    // And the max should equal the total
    expect(cpuMetrics.x).toEqual(cpuMetrics.s);
  });

  test("detect and report long tasks that occured before the lux.js script", async () => {
    await navigateTo("http://localhost:3000/no-inline-snippet-with-cpu.html");
    const luxRequests = requestInterceptor.createRequestMatcher("https://lux.speedcurve.com/lux/");
    const beacon = luxRequests.getUrl(0);
    const cpuMetrics = parseNestedPairs(beacon.searchParams.get("CPU"));

    expect(parseInt(cpuMetrics.n, 10)).toEqual(1);
    expect(parseInt(cpuMetrics.s, 10)).toBeGreaterThan(49);

    // The test page should have one long task, so the median should equal the total
    expect(cpuMetrics.d).toEqual(cpuMetrics.s);

    // And the max should equal the total
    expect(cpuMetrics.x).toEqual(cpuMetrics.s);
  });
});
