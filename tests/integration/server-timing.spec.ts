import { test, expect } from "@playwright/test";
import * as ST from "../../src/server-timing";
import { getSearchParam, parseNestedPairs } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("Server timing", () => {
  const serverTimingMetrics = [
    'cache;dur=0;desc="Cache lookup time"',
    "cacheMiss",
    'db;dur=320;desc="Query duration"',
    "fastly-pop;desc=AMS",
    "hit-state;desc=PASS",
    "invalidNumericDescription;desc=not-123-numeric",
    'loggedIn;desc="User is logged in"',
    "phpMemory;desc=92.4MB",
    "render;dur=0.0435;desc='Render time in seconds'",
    "responseSize;desc=10492",
  ].join(",");

  test("no server timing is collected by default", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(`/default.html?serverTiming=${serverTimingMetrics}`);
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("CD")).toBeNull();
  });

  test("server timing metrics configured in LUX.serverTiming are collected", async ({ page }) => {
    const serverTimingConfig: ST.ServerTimingConfig = {
      cache: [ST.TYPE_DURATION],
      cacheMiss: [ST.TYPE_DESCRIPTION],
      "hit-state": [ST.TYPE_DESCRIPTION],
      invalidNumericDescription: [ST.TYPE_DESCRIPTION, 1000],
      phpMemory: [ST.TYPE_DESCRIPTION, 1024 * 1024],
      render: [ST.TYPE_DURATION, 1000],
      responseSize: [ST.TYPE_DESCRIPTION],
    };

    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      `/default.html?serverTiming=${serverTimingMetrics}&injectScript=LUX.serverTiming=${JSON.stringify(
        serverTimingConfig,
      )}`,
    );
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["cache"]).toEqual("0");
    expect(customData["cacheMiss"]).toEqual("true");
    expect(customData["db"]).toBeUndefined();
    expect(customData["fastly-pop"]).toBeUndefined();
    expect(customData["hit-state"]).toEqual("PASS");
    expect(customData["invalidNumericDescription"]).toBeUndefined();
    expect(customData["loggedIn"]).toBeUndefined();
    expect(customData["phpMemory"]).toEqual("96888422.4");
    expect(customData["render"]).toEqual("43.5");
    expect(customData["responseSize"]).toEqual("10492");
  });
});
