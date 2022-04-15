import { parseNestedPairs } from "../helpers/lux";

describe("LUX interaction", () => {
  describe("in auto mode", () => {
    let luxRequests;
    let ixBeacon;

    beforeAll(async () => {
      await navigateTo("/interaction.html");
      await page.click("#button-with-id");

      luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
      ixBeacon = luxRequests.getUrl(1);
    });

    test("interaction metrics are gathered", () => {
      const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

      // Separate request for main beacon and interaction beacon
      expect(luxRequests.count()).toEqual(2);

      // Click time
      expect(parseInt(ixMetrics.c)).toBeGreaterThan(1);

      // Click attribution
      expect(ixMetrics.ci).toEqual("button-with-id");

      // Click coordinates
      expect(parseInt(ixMetrics.cx)).toBeGreaterThan(0);
      expect(parseInt(ixMetrics.cy)).toBeGreaterThan(0);

      // FID
      expect(parseInt(ixBeacon.searchParams.get("FID"))).toBeGreaterThan(0);
    });

    test("only high level metrics are sent in the interaction beacon", () => {
      expect(ixBeacon.searchParams.get("HN")).toEqual("localhost");
      expect(ixBeacon.searchParams.get("PN")).toEqual("/interaction.html");

      // Pathname should be the last query parameter
      const lastQueryParam = [...ixBeacon.searchParams.entries()].pop();

      expect(lastQueryParam).toEqual(["PN", "/interaction.html"]);
    });
  });

  test("gather IX metrics in a SPA", async () => {
    await navigateTo("/interaction.html?injectScript=LUX.auto=false;");
    await page.evaluate("LUX.send()");
    await page.waitForTimeout(100);

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(20);
    await page.click("button");
    await page.evaluate("LUX.send()");

    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    const fid = parseInt(ixBeacon.searchParams.get("FID"));

    expect(parseInt(ixMetrics.c)).toBeGreaterThan(20);
    expect(parseInt(ixMetrics.c)).toBeLessThan(100);
    expect(fid).toBeGreaterThan(0);
    expect(fid).toBeLessThan(100);
  });
});
