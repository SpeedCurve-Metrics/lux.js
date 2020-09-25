let luxRequests;

beforeAll(async () => {
  await page.goto("http://localhost:3000/default.html", { waitUntil: "networkidle0" });

  luxRequests = requestInterceptor.findMatchingRequests("https://lux.speedcurve.com/lux/");
});

describe("LUX auto", () => {
  it("should send a LUX beacon", async () => {
    expect(luxRequests.length).toBe(1);
  });

  it("should use the document title as the page label", async () => {
    const beacon = new URL(luxRequests[0].url());

    expect(beacon.searchParams.get("l")).toBe("LUX Auto Test");
  });

  it("should send the basic page metrics", async () => {
    const beacon = new URL(luxRequests[0].url());

    expect(beacon.searchParams.get("NT").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("PS").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("HN").length).toBeGreaterThan(0);
  });
});
