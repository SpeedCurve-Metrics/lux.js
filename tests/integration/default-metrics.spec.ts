import { test, expect } from "@playwright/test";
import { SNIPPET_VERSION, versionAsFloat } from "../../src/version";
import { getLuxJsStat, getSearchParam } from "../helpers/lux";
import * as Shared from "../helpers/shared-tests";
import RequestInterceptor from "../request-interceptor";

test.describe("Default metrics in auto mode", () => {
  test("basic functionality", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    // LUX beacon is automatically sent
    expect(luxRequests.count()).toEqual(1);

    // Script and snippet versions are included in the beacon
    expect(getSearchParam(beacon, "v")).toEqual(versionAsFloat().toString());
    // The es2020 variant is set in tests/server.mjs
    expect(getSearchParam(beacon, "sv")).toEqual(`${SNIPPET_VERSION}-es2020`);

    // customer ID is detected correctly
    expect(getSearchParam(beacon, "id")).toEqual("10001");

    // page ID and session ID are sent
    expect(getSearchParam(beacon, "sid").length).toBeGreaterThan(0);
    expect(getSearchParam(beacon, "uid").length).toBeGreaterThan(0);

    // interaction data is not sent when there are no interactions
    expect(beacon.searchParams.get("IX")).toBeNull();

    if (browserName === "chromium") {
      // CLS is set to zero when there are no layout shifts
      expect(parseFloat(getSearchParam(beacon, "CLS"))).toEqual(0);
    } else {
      expect(beacon.searchParams.get("CLS")).toBeNull();
    }

    // hostname and pathname are set
    expect(getSearchParam(beacon, "HN")).toEqual("localhost");
    expect(getSearchParam(beacon, "PN")).toEqual("/default.html");
  });

  test("page stats", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    Shared.testPageStats({ page, browserName, beacon });
  });

  test("lux.js internal stats", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    // metrics about the lux.js script are sent
    expect(getLuxJsStat(beacon, "d")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "t")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "f")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "c")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "n")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "e")).toBeGreaterThanOrEqual(0);
    expect(getLuxJsStat(beacon, "r")).toEqual(100);
    expect(getLuxJsStat(beacon, "l")).toBeGreaterThan(0);
    expect(getLuxJsStat(beacon, "s")).toBeGreaterThan(0);

    if (browserName !== "webkit") {
      // WebKit seems flaky with response size metrics
      expect(getLuxJsStat(beacon, "x")).toBeGreaterThan(0);
    }

    // interaction metrics are not sent with no interaction
    expect(beacon.searchParams.get("FID")).toBeNull();
    expect(beacon.searchParams.get("INP")).toBeNull();
    expect(beacon.searchParams.get("IX")).toBeNull();
  });
});
