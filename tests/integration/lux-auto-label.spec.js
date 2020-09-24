describe("LUX auto with custom label", () => {
  it("should use the custom label as the page label", async () => {
    await page.goto("http://localhost:3000/lux-auto-label.html", { waitUntil: "networkidle0" });
    const luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
    const beacon = new URL(luxRequests[0].url());

    expect(beacon.searchParams.get("l")).toBe("Custom Label");
  });
});
