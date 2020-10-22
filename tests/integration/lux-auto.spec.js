let luxRequests;

beforeAll(async () => {
  await navigateTo("http://localhost:3000/default.html");
  luxRequests = requestInterceptor.createRequestMatcher("https://lux.speedcurve.com/lux/");
});

describe("LUX auto", () => {
  test("automatically sending a LUX beacon", async () => {
    expect(luxRequests.length).toBe(1);
  });

  test("using the document title as the page label", async () => {
    const beacon = new URL(luxRequests[0].url());

    expect(beacon.searchParams.get("l")).toBe("LUX Auto Test");
  });

  test("sending the basic page metrics", async () => {
    const beacon = new URL(luxRequests[0].url());

    expect(beacon.searchParams.get("NT").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("PS").length).toBeGreaterThan(0);
    expect(beacon.searchParams.get("HN").length).toBeGreaterThan(0);
  });
});
