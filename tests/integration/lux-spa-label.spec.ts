describe("LUX SPA page labels", () => {
  test("page label can be changed between SPA page loads", async () => {
    let beacon;
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.label = 'First Label'");
    await page.evaluate("LUX.send()");

    beacon = luxRequests.getUrl(0);
    expect(beacon.searchParams.get("l")).toEqual("First Label");

    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.label = 'Second Label'");
    await page.evaluate("LUX.send()");

    beacon = luxRequests.getUrl(1);
    expect(beacon.searchParams.get("l")).toEqual("Second Label");
  });

  test("default page label changes when document.title changes", async () => {
    let beacon;
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.send()");

    beacon = luxRequests.getUrl(0);
    expect(beacon.searchParams.get("l")).toEqual("LUX SPA Test");

    await page.evaluate("LUX.init()");
    await page.evaluate("document.title = 'New Document Title'");
    await page.evaluate("LUX.send()");

    beacon = luxRequests.getUrl(1);
    expect(beacon.searchParams.get("l")).toEqual("New Document Title");
  });
});
