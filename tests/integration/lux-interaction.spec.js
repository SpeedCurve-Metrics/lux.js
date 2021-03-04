const { parseNestedPairs } = require("../helpers/lux");

describe("LUX interaction", () => {
  test("gather IX metrics after the first interaction", async () => {
    await navigateTo("http://localhost:3000/default-with-interaction.html");
    await page.click("button");
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    expect(luxRequests.count()).toEqual(2);

    // Click time
    expect(parseInt(ixMetrics.c, 10)).toBeGreaterThan(1);

    // Click attribution
    expect(ixMetrics.ci).toEqual("content");

    // Click coordinates
    expect(parseInt(ixMetrics.cx, 10)).toBeGreaterThan(1);
    expect(parseInt(ixMetrics.cy, 10)).toBeGreaterThan(1);
  });
});
