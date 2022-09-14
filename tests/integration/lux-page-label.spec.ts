import Flags from "../../src/flags";
import { hasFlag } from "../helpers/lux";

describe("LUX page labels", () => {
  describe("in auto mode", () => {
    test("no custom label set", async () => {
      await navigateTo("/default.html");
      const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
      const beacon = luxRequests.getUrl(0);

      expect(beacon.searchParams.get("l")).toEqual("LUX default test page");
      expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(true);
      expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(false);
    });

    test("using a custom label", async () => {
      await navigateTo("/default.html?injectScript=LUX.label='Custom Label';");
      const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
      const beacon = luxRequests.getUrl(0);

      expect(beacon.searchParams.get("l")).toEqual("Custom Label");
      expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(true);
      expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(false);
    });

    test("custom label is null", async () => {
      await navigateTo("/default.html?injectScript=LUX.label=null;");
      const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
      const beacon = luxRequests.getUrl(0);

      expect(beacon.searchParams.get("l")).toEqual("LUX default test page");
      expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(true);
      expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(false);
    });

    test("using a pagegroup label", async () => {
      await navigateTo(
        "/default.html?injectScript=LUX.label=null;LUX.pagegroups={'Pagegroup':['localhost/default.html']};"
      );
      const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
      const beacon = luxRequests.getUrl(0);

      expect(beacon.searchParams.get("l")).toEqual("Pagegroup");
      expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(true);
      expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
    });

    test("LUX.label takes priority over pagegroup label", async () => {
      await navigateTo(
        "/default.html?injectScript=LUX.pagegroups={'Pagegroup':['localhost/default.html']};LUX.label='custom label';"
      );
      const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
      const beacon = luxRequests.getUrl(0);

      expect(beacon.searchParams.get("l")).toEqual("custom label");
      expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(true);
      expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
    });
  });

  describe("in a SPA", () => {
    test("page label can be changed between SPA page loads", async () => {
      let beacon;
      const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

      await navigateTo("/default.html?injectScript=LUX.auto=false;");
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

      await navigateTo("/default.html?injectScript=LUX.auto=false;");
      await page.evaluate("LUX.send()");

      beacon = luxRequests.getUrl(0);
      expect(beacon.searchParams.get("l")).toEqual("LUX default test page");

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
      await navigateTo(
        "/default.html?injectScript=LUX.auto=false;LUX.jspagelabel='config.page[0].name';"
      );
    });

    test("can be taken from a global JS variable", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("window.config.page[0].name = 'JS Label'");
      await page.evaluate("LUX.send()");

      const beacon = luxRequests.getUrl(0);
      expect(beacon.searchParams.get("l")).toEqual("JS Label");
      expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(true);
      expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(false);
      expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(false);

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

    test("LUX.pagegroups takes priority over JS page label", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("LUX.pagegroups = {'Pagegroup':['localhost/default.html']}");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual("Pagegroup");

      await page.evaluate("LUX.init()");
      await page.evaluate("delete LUX.pagegroups");
      await page.evaluate("window.config.page[0].name = 'JS Label'");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(1).searchParams.get("l")).toEqual("JS Label");
    });

    test("falls back to JS variable when pagegroup doesn't match", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("window.config.page[0].name = 'JS Label'");
      await page.evaluate("LUX.pagegroups = {'Pagegroup':['/not-this-page/*']}");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual("JS Label");
    });

    test("falls back to document title when JS variable doesn't eval", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("window.config = {}");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual("LUX default test page");
    });

    test("falls back to document title when JS variable evaluates to a falsey value", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("window.config.page[0].name = ''");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual("LUX default test page");
    });

    test("internal LUX variables can't be accessed", async () => {
      await page.evaluate("LUX.init()");
      await page.evaluate("LUX.jspagelabel = '_getPageLabel.toString()'");
      await page.evaluate("LUX.send()");

      expect(luxRequests.getUrl(0).searchParams.get("l")).toEqual("LUX default test page");
    });
  });
});
