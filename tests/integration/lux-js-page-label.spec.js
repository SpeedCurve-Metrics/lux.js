describe("LUX JS page label", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("https://lux.speedcurve.com/lux/");

  beforeEach(async () => {
    luxRequests.reset();

    await page.evaluate(() => {
      window.config = {
        page: [
          {
            name: "default",
          },
        ],
      };
    });
  });

  beforeAll(async () => {
    await navigateTo("http://localhost:3000/auto-false-js-page-label.html");
  });

  test("can be taken from a global JS variable", async () => {
    await page.evaluate("LUX.init()");
    await page.evaluate("window.config.page[0].name = 'JS Label'");
    await page.evaluate("LUX.send()");

    expect(luxRequests.getUrl(0).searchParams.get("l")).toBe("JS Label");

    await page.evaluate("LUX.init()");
    await page.evaluate("window.config.page[0].name = 'Another JS Label'");
    await page.evaluate("LUX.send()");

    expect(luxRequests.getUrl(1).searchParams.get("l")).toBe("Another JS Label");
  });

  test("the variable can be changed on the fly", async () => {
    await page.evaluate("LUX.init()");
    await page.evaluate("window.config.page[0].name = 'First JS Label'");
    await page.evaluate("LUX.send()");

    expect(luxRequests.getUrl(0).searchParams.get("l")).toBe("First JS Label");

    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.jspagelabel = 'window.config.page[0].label'");
    await page.evaluate("window.config.page[0].label = 'Different Variable Label'");
    await page.evaluate("LUX.send()");

    expect(luxRequests.getUrl(1).searchParams.get("l")).toBe("Different Variable Label");

    // Restore jspagelabel to previous state
    await page.evaluate("LUX.jspagelabel = 'window.config.page[0].name'");
  });

  test("LUX.label takes priority over JS page label", async () => {
    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.label = 'custom label'");
    await page.evaluate("LUX.send()");

    expect(luxRequests.getUrl(0).searchParams.get("l")).toBe("custom label");

    await page.evaluate("LUX.init()");
    await page.evaluate("delete LUX.label");
    await page.evaluate("window.config.page[0].name = 'JS Label'");
    await page.evaluate("LUX.send()");

    expect(luxRequests.getUrl(1).searchParams.get("l")).toBe("JS Label");
  });

  test("falls back to document title when JS variable doesn't eval", async () => {
    await page.evaluate("LUX.init()");
    await page.evaluate("window.config = {}");
    await page.evaluate("LUX.send()");

    expect(luxRequests.getUrl(0).searchParams.get("l")).toBe("LUX SPA Test With JS Page Label");
  });

  test("falls back to document title when JS variable evaluates to a falsey value", async () => {
    await page.evaluate("LUX.init()");
    await page.evaluate("window.config.page[0].name = ''");
    await page.evaluate("LUX.send()");

    expect(luxRequests.getUrl(0).searchParams.get("l")).toBe("LUX SPA Test With JS Page Label");
  });
});
