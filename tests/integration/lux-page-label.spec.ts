import Flags, { hasFlag } from "../../src/flags";

describe("LUX page labels", () => {
  describe("in auto mode", () => {
    test("no custom label set", async () => {
      await navigateTo("http://localhost:3000/default.html");
      const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
      const beacon = luxRequests.getUrl(0);
      const beaconFlags = parseInt(beacon.searchParams.get("fl"), 10);

      expect(beacon.searchParams.get("l")).toEqual("LUX Auto Test");
      expect(hasFlag(beaconFlags, Flags.PageLabelFromDocumentTitle)).toBe(true);
      expect(hasFlag(beaconFlags, Flags.PageLabelFromLabelProp)).toBe(false);
      expect(hasFlag(beaconFlags, Flags.PageLabelFromGlobalVariable)).toBe(false);
    });

    test("using a custom label", async () => {
      await navigateTo("http://localhost:3000/default-with-label.html");
      const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
      const beacon = luxRequests.getUrl(0);
      const beaconFlags = parseInt(beacon.searchParams.get("fl"), 10);

      expect(beacon.searchParams.get("l")).toEqual("Custom Label");
      expect(hasFlag(beaconFlags, Flags.PageLabelFromLabelProp)).toBe(true);
      expect(hasFlag(beaconFlags, Flags.PageLabelFromDocumentTitle)).toBe(false);
      expect(hasFlag(beaconFlags, Flags.PageLabelFromGlobalVariable)).toBe(false);
    });
  });

  describe("in a SPA", () => {
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

  describe("LUX JS page label", () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

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

      const beacon = luxRequests.getUrl(0);
      const beaconFlags = parseInt(beacon.searchParams.get("fl"), 10);
      expect(beacon.searchParams.get("l")).toEqual("JS Label");
      expect(hasFlag(beaconFlags, Flags.PageLabelFromGlobalVariable)).toBe(true);
      expect(hasFlag(beaconFlags, Flags.PageLabelFromLabelProp)).toBe(false);
      expect(hasFlag(beaconFlags, Flags.PageLabelFromDocumentTitle)).toBe(false);

      await page.evaluate("LUX.init()");
      await page.evaluate("window.config.page[0].name = 'Another JS Label'");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(1).searchParams.get("l")).toEqual("Another JS Label");
    });

    test("the variable can be changed on the fly", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("window.config.page[0].name = 'First JS Label'");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual("First JS Label");

      await page.evaluate("LUX.init()");
      await page.evaluate("LUX.jspagelabel = 'window.config.page[0].label'");
      await page.evaluate("window.config.page[0].label = 'Different Variable Label'");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(1).searchParams.get("l")).toEqual("Different Variable Label");

      // Restore jspagelabel to previous state
      await page.evaluate("LUX.jspagelabel = 'window.config.page[0].name'");
    });

    test("LUX.label takes priority over JS page label", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("LUX.label = 'custom label'");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual("custom label");

      await page.evaluate("LUX.init()");
      await page.evaluate("delete LUX.label");
      await page.evaluate("window.config.page[0].name = 'JS Label'");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(1).searchParams.get("l")).toEqual("JS Label");
    });

    test("falls back to document title when JS variable doesn't eval", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("window.config = {}");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual(
        "LUX SPA Test With JS Page Label"
      );
    });

    test("falls back to document title when JS variable evaluates to a falsey value", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("window.config.page[0].name = ''");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual(
        "LUX SPA Test With JS Page Label"
      );
    });

    test("internal LUX variables can't be accessed", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("LUX.jspagelabel = '_getPageLabel.toString()'");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual(
        "LUX SPA Test With JS Page Label"
      );
    });
  });
});
