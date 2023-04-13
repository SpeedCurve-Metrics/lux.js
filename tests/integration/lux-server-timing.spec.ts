import * as ST from "../../src/server-timing";
import { parseNestedPairs } from "../helpers/lux";

describe("Server timing", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
  const defaultServerTimingMetrics = [
    'cache;dur=0;desc="Cache lookup time"',
    "cacheMiss",
    'db;dur=320;desc="Query duration"',
    "fastly-pop;desc=AMS",
    "hit-state;desc=PASS",
    'loggedIn;desc="User is logged in"',
    "render;dur=43.5",
  ].join(",");

  beforeEach(() => {
    luxRequests.reset();
  });

  test("no server timing is collected by default", async () => {
    await navigateTo(`/default.html?serverTiming=${defaultServerTimingMetrics}`);

    const beacon = luxRequests.getUrl(0);

    expect(beacon.searchParams.get("CD")).toBeNull();
  });

  test("server timing metrics configured in LUX.serverTiming are collected", async () => {
    const serverTimingConfig = {
      cache: ST.TYPE_DURATION,
      cacheMiss: ST.TYPE_DESCRIPTION,
      "hit-state": ST.TYPE_DESCRIPTION,
      render: ST.TYPE_DURATION,
    };

    await navigateTo(
      `/default.html?serverTiming=${defaultServerTimingMetrics}&injectScript=LUX.serverTiming=${JSON.stringify(
        serverTimingConfig
      )}`
    );

    const beacon = luxRequests.getUrl(0);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["cacheMiss"]).toEqual("true");
    expect(customData["cache"]).toEqual("0");
    expect(customData["db"]).toBeUndefined();
    expect(customData["fastly-pop"]).toBeUndefined();
    expect(customData["hit-state"]).toEqual("PASS");
    expect(customData["loggedIn"]).toBeUndefined();
    expect(customData["render"]).toEqual("43.5");
  });
});
