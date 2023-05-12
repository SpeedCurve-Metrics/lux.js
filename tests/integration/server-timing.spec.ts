import { test, expect } from "@playwright/test";
import * as ST from "../../src/server-timing";
import { getSearchParam, parseNestedPairs } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("Server timing", () => {
  const defaultServerTimingMetrics = [
    'cache;dur=0;desc="Cache lookup time"',
    "cacheMiss",
    'db;dur=320;desc="Query duration"',
    "fastly-pop;desc=AMS",
    "hit-state;desc=PASS",
    'loggedIn;desc="User is logged in"',
    "render;dur=43.5",
  ].join(",");

  test("no server timing is collected by default", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(`/default.html?serverTiming=${defaultServerTimingMetrics}`);
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("CD")).toBeNull();
  });

  test("server timing metrics configured in LUX.serverTiming are collected", async ({ page }) => {
    const serverTimingConfig = {
      cache: ST.TYPE_DURATION,
      cacheMiss: ST.TYPE_DESCRIPTION,
      "hit-state": ST.TYPE_DESCRIPTION,
      render: ST.TYPE_DURATION,
    };

    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      `/default.html?serverTiming=${defaultServerTimingMetrics}&injectScript=LUX.serverTiming=${JSON.stringify(
        serverTimingConfig
      )}`
    );
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["cacheMiss"]).toEqual("true");
    expect(customData["cache"]).toEqual("0");
    expect(customData["db"]).toBeUndefined();
    expect(customData["fastly-pop"]).toBeUndefined();
    expect(customData["hit-state"]).toEqual("PASS");
    expect(customData["loggedIn"]).toBeUndefined();
    expect(customData["render"]).toEqual("43.5");
  });
});
