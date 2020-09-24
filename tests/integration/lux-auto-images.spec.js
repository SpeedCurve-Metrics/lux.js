const extractTimingValue = require("../helpers/lux").extractTimingValue

describe("LUX auto images", () => {
  it("should calculate the number of images on the page", async () => {
    await page.goto("http://localhost:3000/lux-auto-images.html", { waitUntil: "networkidle0" });
    const luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    const beacon = new URL(luxRequests[0].url());

    const pageStats = beacon.searchParams.get("PS");
    console.log({pageStats})
    const totalImages = extractTimingValue(pageStats, "it");
    const imagesAboveFold = extractTimingValue(pageStats, "ia");

    expect(totalImages).toBe(3);
    expect(imagesAboveFold).toBe(2);
  });
});
