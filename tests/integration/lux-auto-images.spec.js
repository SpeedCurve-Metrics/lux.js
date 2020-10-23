const { extractCondensedValue } = require("../helpers/lux");

describe("LUX auto images", () => {
  test("calculating the number of images on the page", async () => {
    await navigateTo("http://localhost:3000/default-with-images.html");
    const luxRequests = requestInterceptor.createRequestMatcher("https://lux.speedcurve.com/lux/");
    const beacon = luxRequests.getUrl(0);

    const pageStats = beacon.searchParams.get("PS");
    const totalImages = extractCondensedValue(pageStats, "it");
    const imagesAboveFold = extractCondensedValue(pageStats, "ia");

    expect(totalImages).toBe(3);
    expect(imagesAboveFold).toBe(2);
  });
});
