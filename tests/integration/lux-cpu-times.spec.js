const { parseNestedPairs } = require("../helpers/lux");

describe("LUX CPU timing", () => {
  it("should detect and report long tasks on the page", async () => {
    await page.goto("http://localhost:3000/default-with-cpu.html", { waitUntil: "networkidle0" });
    const luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    const beacon = new URL(luxRequests[0].url());
    const cpuMetrics = parseNestedPairs(beacon.searchParams.get("CPU"));

    expect(parseInt(cpuMetrics.n, 10)).toBe(1);
    expect(parseInt(cpuMetrics.s, 10)).toBeGreaterThan(49);

    // The test page should have one long task, so the median should equal the total
    expect(cpuMetrics.d).toEqual(cpuMetrics.s);

    // And the max should equal the total
    expect(cpuMetrics.x).toEqual(cpuMetrics.s);
  });
});
