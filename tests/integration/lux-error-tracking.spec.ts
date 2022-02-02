describe("LUX JavaScript error tracking", () => {
  beforeAll(() => {
    reportErrors = false;
  });

  afterAll(() => {
    reportErrors = true;
  });

  test("sending a separate beacon for each error", async () => {
    const beaconRequests = requestInterceptor.createRequestMatcher("/beacon/");
    const errorRequests = requestInterceptor.createRequestMatcher("/error/");

    await navigateTo("http://localhost:3000/default-with-errors.html");

    expect(beaconRequests.count()).toEqual(1);
    expect(errorRequests.count()).toEqual(2);

    const firstError = errorRequests.getUrl(0);
    const secondError = errorRequests.getUrl(1);

    expect(firstError.searchParams.get("msg")).toContain("ReferenceError: foo is not defined");
    expect(firstError.searchParams.get("l")).toEqual("LUX Auto Test");
    expect(firstError.searchParams.get("HN")).toEqual("localhost");
    expect(firstError.searchParams.get("PN")).toEqual("/default-with-errors.html");

    expect(secondError.searchParams.get("msg")).toContain("SyntaxError: Unexpected end of input");
    expect(secondError.searchParams.get("l")).toEqual("LUX Auto Test");
    expect(secondError.searchParams.get("HN")).toEqual("localhost");
    expect(secondError.searchParams.get("PN")).toEqual("/default-with-errors.html");
  });

  test("error reporting in a SPA", async () => {
    const errorRequests = requestInterceptor.createRequestMatcher("/error/");

    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.label = 'SPA Label'");
    await page.addScriptTag({ content: "foo.bar()" });

    const errorBeacon = errorRequests.getUrl(0);

    expect(errorBeacon.searchParams.get("msg")).toContain("ReferenceError: foo is not defined");
    expect(errorBeacon.searchParams.get("l")).toEqual("SPA Label");
    expect(errorBeacon.searchParams.get("HN")).toEqual("localhost");
    expect(errorBeacon.searchParams.get("PN")).toEqual("/auto-false.html");
  });

  test("errors can be limited", async () => {
    const errorRequests = requestInterceptor.createRequestMatcher("/error/");

    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.maxErrors = 2");
    await page.addScriptTag({ content: "bar()" });
    await page.addScriptTag({ content: "baz()" });
    await page.addScriptTag({ content: "bam()" });

    expect(errorRequests.count()).toEqual(2);
  });

  test("max errors are reset for each page view", async () => {
    const errorRequests = requestInterceptor.createRequestMatcher("/error/");

    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.maxErrors = 2");
    await page.evaluate("LUX.send()");
    await page.addScriptTag({ content: "bar()" });
    await page.addScriptTag({ content: "baz()" });
    await page.addScriptTag({ content: "bam()" });
    await page.evaluate("LUX.init()");
    await page.addScriptTag({ content: "bam()" });

    expect(errorRequests.count()).toEqual(3);
  });

  test("error reporting can be disabled", async () => {
    const errorRequests = requestInterceptor.createRequestMatcher("/error/");

    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.trackErrors = false");
    await page.addScriptTag({ content: "foo.bar()" });

    expect(errorRequests.count()).toEqual(0);

    await page.evaluate("LUX.trackErrors = true");
    await page.addScriptTag({ content: "bing.bong()" });

    expect(errorRequests.count()).toEqual(1);

    const errorBeacon = errorRequests.getUrl(0);

    expect(errorBeacon.searchParams.get("msg")).toContain("ReferenceError: bing is not defined");
  });
});