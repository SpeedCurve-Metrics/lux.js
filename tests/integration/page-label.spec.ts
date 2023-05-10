import { test, expect } from "@playwright/test";
import Flags from "../../src/flags";
import { hasFlag } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX page labels in auto mode", () => {
  test("no custom label set", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("l")).toEqual("LUX default test page");
    expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(true);
    expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(false);
  });

  test("using a custom label", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.label='Custom Label';");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("l")).toEqual("Custom Label");
    expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(true);
    expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(false);
  });

  test("custom label is null", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.label=null;");
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("l")).toEqual("LUX default test page");
    expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(true);
    expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(false);
  });

  test("using a pagegroup label", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.label=null;LUX.pagegroups={'Pagegroup':['localhost/default.html']};"
    );
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("l")).toEqual("Pagegroup");
    expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(true);
    expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
  });

  test("LUX.label takes priority over pagegroup label", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.pagegroups={'Pagegroup':['localhost/default.html']};LUX.label='custom label';"
    );
    await luxRequests.waitForMatchingRequest();
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("l")).toEqual("custom label");
    expect(hasFlag(beacon, Flags.PageLabelFromPagegroup)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(true);
    expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(false);
  });
});

test.describe("LUX page labels in a SPA", () => {
  test("page label can be changed between SPA page loads", async ({ page }) => {
    let beacon;
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.label = "First Label";
        LUX.send();
      })
    );

    beacon = luxRequests.getUrl(0)!;
    expect(beacon.searchParams.get("l")).toEqual("First Label");

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.label = "Second Label";
        LUX.send();
      })
    );

    beacon = luxRequests.getUrl(1)!;
    expect(beacon.searchParams.get("l")).toEqual("Second Label");
  });

  test("default page label changes when document.title changes", async ({ page }) => {
    let beacon;
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto("/default.html?injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    beacon = luxRequests.getUrl(0)!;
    expect(beacon.searchParams.get("l")).toEqual("LUX default test page");

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        document.title = "New Document Title";
        LUX.send();
      })
    );

    beacon = luxRequests.getUrl(1)!;
    expect(beacon.searchParams.get("l")).toEqual("New Document Title");
  });
});

test.describe("LUX JS page label", () => {
  let luxRequests;

  test.beforeEach(async ({ page }) => {
    luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.auto=false;LUX.jspagelabel='config.page[0].name';"
    );

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

  test("can be taken from a global JS variable", async ({ page }) => {
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        window.config.page[0].name = "JS Label";
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    expect(beacon.searchParams.get("l")).toEqual("JS Label");
    expect(hasFlag(beacon, Flags.PageLabelFromGlobalVariable)).toBe(true);
    expect(hasFlag(beacon, Flags.PageLabelFromLabelProp)).toBe(false);
    expect(hasFlag(beacon, Flags.PageLabelFromDocumentTitle)).toBe(false);

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        window.config.page[0].name = "Another JS Label";
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(1).searchParams.get("l"))!.toEqual("Another JS Label");
  });

  test("the variable can be changed on the fly", async ({ page }) => {
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        window.config.page[0].name = "First JS Label";
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(0).searchParams.get("l"))!.toEqual("First JS Label");

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.jspagelabel = "window.config.page[0].label";
        window.config.page[0].label = "Different Variable Label";
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(1).searchParams.get("l"))!.toEqual("Different Variable Label");

    // Restore jspagelabel to previous state
    await page.evaluate(() => (LUX.jspagelabel = "window.config.page[0].name"));
  });

  test("LUX.label takes priority over JS page label", async ({ page }) => {
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.label = "custom label";
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(0).searchParams.get("l"))!.toEqual("custom label");

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        delete LUX.label;
        window.config.page[0].name = "JS Label";
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(1).searchParams.get("l"))!.toEqual("JS Label");
  });

  test("LUX.pagegroups takes priority over JS page label", async ({ page }) => {
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.pagegroups = { Pagegroup: ["localhost/default.html"] };
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(0).searchParams.get("l"))!.toEqual("Pagegroup");

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        delete LUX.pagegroups;
        window.config.page[0].name = "JS Label";
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(1).searchParams.get("l"))!.toEqual("JS Label");
  });

  test("falls back to JS variable when pagegroup doesn't match", async ({ page }) => {
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        window.config.page[0].name = "JS Label";
        LUX.pagegroups = { Pagegroup: ["/not-this-page/*"] };
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(0).searchParams.get("l"))!.toEqual("JS Label");
  });

  test("falls back to document title when JS variable doesn't eval", async ({ page }) => {
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        window.config = {};
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(0).searchParams.get("l"))!.toEqual("LUX default test page");
  });

  test("falls back to document title when JS variable evaluates to a falsey value", async ({
    page,
  }) => {
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        window.config.page[0].name = "";
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(0).searchParams.get("l"))!.toEqual("LUX default test page");
  });

  test("internal LUX variables can't be accessed", async ({ page }) => {
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.jspagelabel = "_getPageLabel.toString()";
        LUX.send();
      })
    );

    expect(luxRequests.getUrl(0).searchParams.get("l"))!.toEqual("LUX default test page");
  });
});
