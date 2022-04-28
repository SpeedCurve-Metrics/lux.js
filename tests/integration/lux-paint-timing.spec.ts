import { getNavTiming } from "../helpers/lux";

describe("LUX paint timing", () => {
  test("paint times are recorded", async () => {
    await navigateTo("/images.html");
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const beacon = luxRequests.getUrl(0);
    const startRender = getNavTiming(beacon, "sr");

    expect(startRender).toBeGreaterThan(0);
    expect(getNavTiming(beacon, "fc")).toBeGreaterThanOrEqual(startRender);
    expect(getNavTiming(beacon, "lc")).toBeGreaterThanOrEqual(startRender);
  });
});
