describe("LUX beacon request", () => {
  test("beacon is sent with a GET request", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

    await navigateTo("http://localhost:3000/default.html");

    expect(luxRequests.count()).toEqual(1);
    expect(luxRequests.get(0).method()).toEqual("GET");
  });

  test("beacon is split into multiple requests when the URL is too long", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const mediumString = new Array(5000).fill("A").join(""); // About 5KB
    const longString = new Array(8000).fill("A").join(""); // About 8KB (the URL length limit)

    await navigateTo("http://localhost:3000/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(`performance.mark("${mediumString}")`);
    await page.evaluate("LUX.send()");
    expect(luxRequests.count()).toEqual(1);
    expect(luxRequests.getUrl(0).toString()).toContain(mediumString);
    luxRequests.reset();

    await page.evaluate("LUX.init()");
    await page.evaluate(`performance.mark("${longString}")`);
    await page.evaluate("LUX.send()");
    expect(luxRequests.count()).toEqual(2);
    expect(luxRequests.getUrl(0).toString()).not.toContain(longString);
    expect(luxRequests.getUrl(1).toString()).toContain(longString);
  });
});
