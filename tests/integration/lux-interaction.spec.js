const { parseNestedPairs } = require("../helpers/lux");

describe("LUX interaction", () => {
  test("gather IX metrics after the first interaction", async () => {
    await navigateTo("http://localhost:3000/default-with-interaction.html");
    await page.click("#button-with-id");

    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    // Separate request for main beacon and interaction beacon
    expect(luxRequests.count()).toEqual(2);

    // Click time
    expect(parseInt(ixMetrics.c, 10)).toBeGreaterThan(1);

    // Click attribution
    expect(ixMetrics.ci).toEqual("button-with-id");

    // Click coordinates
    expect(parseInt(ixMetrics.cx, 10)).toBeGreaterThan(0);
    expect(parseInt(ixMetrics.cy, 10)).toBeGreaterThan(0);
  });

  test("gather IX metrics in a SPA", async () => {
    await navigateTo("http://localhost:3000/auto-false-with-interaction.html");
    await page.evaluate("LUX.send()");
    await page.waitForTimeout(100);

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(20);
    await page.click("button");
    await page.evaluate("LUX.send()");

    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    expect(parseInt(ixMetrics.c, 10)).toBeGreaterThan(20);
    expect(parseInt(ixMetrics.c, 10)).toBeLessThan(100);
  });

  test("measure FID after the first interaction", async () => {
    await navigateTo("http://localhost:3000/default-with-interaction.html");
    await page.click("#button-with-id");

    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const ixBeacon = luxRequests.getUrl(1);
    const fid = parseInt(ixBeacon.searchParams.get("FID"), 10);

    expect(fid).toBeGreaterThan(0);
  });

  test("measure FID in a SPA", async () => {
    await navigateTo("http://localhost:3000/auto-false-with-interaction.html");
    await page.evaluate("LUX.send()");
    await page.waitForTimeout(100);

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(20);
    await page.click("button");
    await page.evaluate("LUX.send()");

    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const ixBeacon = luxRequests.getUrl(1);
    const fid = parseInt(ixBeacon.searchParams.get("FID"), 10);

    expect(fid).toBeGreaterThan(0);
    expect(fid).toBeLessThan(100);
  });
});
