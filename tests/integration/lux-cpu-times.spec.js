const { extractCpuMetrics } = require("../helpers/lux");

describe("LUX CPU timing", () => {
  it("should detect and report long tasks on the page", async () => {
    await page.goto("http://localhost:3000/default-with-cpu.html", { waitUntil: "networkidle0" });
    const luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    const beacon = new URL(luxRequests[0].url());
    const cpuMetrics = extractCpuMetrics(beacon.searchParams.get("CPU"));

    expect(cpuMetrics.n).toBe(1);
    expect(cpuMetrics.s).toBeGreaterThan(49);

    // The test page should have one long task, so the median should equal the total
    expect(cpuMetrics.d).toEqual(cpuMetrics.s);

    // And the max should equal the total
    expect(cpuMetrics.x).toEqual(cpuMetrics.s);
  });
});
