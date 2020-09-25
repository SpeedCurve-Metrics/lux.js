const { parseNestedPairs } = require("../helpers/lux");

describe("LUX interaction", () => {
  beforeAll(async () => {
    await page.goto("http://localhost:3000/default-with-interaction.html", { waitUntil: "networkidle0" });
    await page.click("button");
  });

  it("should collect IX metrics after the first interaction", async () => {
    const luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    const ixBeacon = new URL(luxRequests[1].url());
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    expect(luxRequests.length).toBe(2);

    // Click time
    expect(parseInt(ixMetrics.c, 10)).toBeGreaterThan(1);

    // Click attribution
    expect(ixMetrics.ci).toBe("content");

    // Click coordinates
    expect(parseInt(ixMetrics.cx, 10)).toBeGreaterThan(1);
    expect(parseInt(ixMetrics.cy, 10)).toBeGreaterThan(1);
  });
});
