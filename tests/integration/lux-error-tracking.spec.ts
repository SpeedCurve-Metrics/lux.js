import { test, expect } from "@playwright/test";
import { referenceErrorMessage, syntaxErrorMessage } from "../helpers/browsers";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX JavaScript error tracking", () => {
  test("sending a separate beacon for each error", async ({ page, browserName }) => {
    const beaconRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/error/");

    await page.goto("/javascript-errors.html", { waitUntil: "networkidle" });

    expect(beaconRequests.count()).toEqual(1);
    expect(errorRequests.count()).toEqual(2);

    const firstError = errorRequests.getUrl(0)!;
    const secondError = errorRequests.getUrl(1)!;

    expect(firstError.searchParams.get("msg")).toContain(referenceErrorMessage(browserName, "foo"));
    expect(firstError.searchParams.get("l")).toEqual("LUX JavaScript errors test page");
    expect(firstError.searchParams.get("HN")).toEqual("localhost");
    expect(firstError.searchParams.get("PN")).toEqual("/javascript-errors.html");

    expect(secondError.searchParams.get("msg")).toContain(syntaxErrorMessage(browserName));
    expect(secondError.searchParams.get("l")).toEqual("LUX JavaScript errors test page");
    expect(secondError.searchParams.get("HN")).toEqual("localhost");
    expect(secondError.searchParams.get("PN")).toEqual("/javascript-errors.html");
  });

  test("error reporting in a SPA", async ({ page, browserName }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/error/");

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate(() => (LUX.label = "SPA Label"));
    await page.addScriptTag({ content: "foo.bar()" });

    const errorBeacon = errorRequests.getUrl(0)!;

    expect(errorBeacon.searchParams.get("msg")).toContain(
      referenceErrorMessage(browserName, "foo")
    );
    expect(errorBeacon.searchParams.get("l")).toEqual("SPA Label");
    expect(errorBeacon.searchParams.get("HN")).toEqual("localhost");
    expect(errorBeacon.searchParams.get("PN")).toEqual("/default.html");
  });

  test("errors can be limited", async ({ page }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/error/");

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate(() => (LUX.maxErrors = 2));
    await page.addScriptTag({ content: "bar()" });
    await page.addScriptTag({ content: "baz()" });
    await page.addScriptTag({ content: "bam()" });

    expect(errorRequests.count()).toEqual(2);
  });

  test("max errors are reset for each page view", async ({ page }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/error/");

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate(() => (LUX.maxErrors = 2));
    await page.evaluate(() => LUX.send());
    await page.addScriptTag({ content: "bar()" });
    await page.addScriptTag({ content: "baz()" });
    await page.addScriptTag({ content: "bam()" });
    await page.evaluate(() => LUX.init());
    await page.addScriptTag({ content: "bam()" });

    expect(errorRequests.count()).toEqual(3);
  });

  test("error reporting can be disabled", async ({ page, browserName }) => {
    const errorRequests = new RequestInterceptor(page).createRequestMatcher("/error/");

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate(() => (LUX.trackErrors = false));
    await page.addScriptTag({ content: "foo.bar()" });

    expect(errorRequests.count()).toEqual(0);

    await page.evaluate(() => (LUX.trackErrors = true));
    await page.addScriptTag({ content: "bing.bong()" });

    expect(errorRequests.count()).toEqual(1);

    const errorBeacon = errorRequests.getUrl(0)!;

    expect(errorBeacon.searchParams.get("msg")).toContain(
      referenceErrorMessage(browserName, "bing")
    );
  });
});
