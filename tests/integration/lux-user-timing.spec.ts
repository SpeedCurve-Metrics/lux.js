import { parseNestedPairs } from "../helpers/lux";

describe("LUX user timing", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
  let beacon;

  beforeAll(async () => {
    luxRequests.reset();
    await navigateTo("/user-timing.html");
    beacon = luxRequests.getUrl(0);
  });

  test("records all user timing marks and measures", () => {
    const userTiming = parseNestedPairs(beacon.searchParams.get("UT"));

    expect(Object.values(userTiming).length).toEqual(3);
    expect(parseInt(userTiming["first-mark"], 10)).toBeGreaterThan(0);
    expect(parseInt(userTiming["test-mark"], 10)).toBeGreaterThan(0);
    expect(parseInt(userTiming["test-measure"], 10)).toBeGreaterThan(0);
  });
});
