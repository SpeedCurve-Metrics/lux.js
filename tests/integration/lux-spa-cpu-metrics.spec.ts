import { parseNestedPairs } from "../helpers/lux";

describe("LUX SPA CPU metrics", () => {
  test("long tasks are only reported for the SPA page they were associated with", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("http://localhost:3000/long-tasks.html?injectScript=LUX.auto=false;");
    await page.evaluate("LUX.send()");

    let beacon = luxRequests.getUrl(0);
    let cpuMetrics = parseNestedPairs(beacon.searchParams.get("CPU"));

    expect(parseInt(cpuMetrics.n, 10)).toEqual(1);
    expect(parseInt(cpuMetrics.s, 10)).toBeGreaterThan(49);

    // The test page should have one long task, so the median should equal the total
    expect(cpuMetrics.d).toEqual(cpuMetrics.s);

    // And the max should equal the total
    expect(cpuMetrics.x).toEqual(cpuMetrics.s);

    // Initiate a second page view with no long tasks
    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.send()");

    beacon = luxRequests.getUrl(1);
    cpuMetrics = parseNestedPairs(beacon.searchParams.get("CPU"));

    expect(parseInt(cpuMetrics.n, 10)).toEqual(0);

    // Initiate a third page view with long tasks
    await page.evaluate("LUX.init()");
    await page.click("#calculate-primes");
    await page.evaluate("LUX.send()");

    beacon = luxRequests.getUrl(2);
    cpuMetrics = parseNestedPairs(beacon.searchParams.get("CPU"));

    expect(parseInt(cpuMetrics.n, 10)).toEqual(1);
  });
});
