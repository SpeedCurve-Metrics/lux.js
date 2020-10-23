describe("LUX JS page label", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("https://lux.speedcurve.com/lux/");

  beforeAll(async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate(() => {
      window.config = {
        page: [
          {
            name: "default",
          },
        ],
      };
    });
    await page.evaluate("LUX.jspagelabel = 'config.page[0].name'");
  });

  beforeEach(() => {
    luxRequests.reset();
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
});
