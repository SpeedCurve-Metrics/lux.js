import { getPageStat } from "../helpers/lux";

describe("LUX auto images", () => {
  test("calculating the number of images on the page", async () => {
    await navigateTo("/images.html");
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const beacon = luxRequests.getUrl(0);

    expect(getPageStat(beacon, "it")).toEqual(3);
    expect(getPageStat(beacon, "ia")).toEqual(2);
  });
});
