import { test, expect } from "@playwright/test";
import { getSearchParam, parseNestedPairs } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX custom data", () => {
  test("only valid customer data is sent", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("stringVar", "hello");
        LUX.addData("emptyStringVar", "");
        LUX.addData("numberVar", 123);
        LUX.addData("numberZeroVar", 0);
        LUX.addData("booleanFalseVar", false);
        LUX.addData("booleanTrueVar", true);
        LUX.addData("objectVar", { key: "val" });
        LUX.addData("arrayVar", [1, 2, 3]);
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["stringVar"]).toEqual("hello");
    expect(customData["emptyStringVar"]).toEqual("");
    expect(customData["numberVar"]).toEqual("123");
    expect(customData["numberZeroVar"]).toEqual("0");
    expect(customData["booleanFalseVar"]).toEqual("false");
    expect(customData["booleanTrueVar"]).toEqual("true");
    expect(customData["objectVar"]).toBeUndefined();
    expect(customData["arrayVar"]).toBeUndefined();
  });

  test("reserved characters are removed from keys and value", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("var1", "|special,characters|");
        LUX.addData("var|2", "normal string");
        LUX.addData("var|,3", "special, string");
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["var1"]).toEqual("specialcharacters");
    expect(customData["var2"]).toEqual("normal string");
    expect(customData["var3"]).toEqual("special string");
  });

  test("custom data set before LUX.send is sent with the main beacon", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("var1", "hello");
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["var1"]).toEqual("hello");
  });

  test("custom data can be removed", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("var1", "hello");
        LUX.addData("var2", "world");
        LUX.addData("var3", "and");
        LUX.addData("var4", "others");
        LUX.addData("var2", null);
        LUX.addData("var3", undefined);
        LUX.addData("var4");
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["var1"]).toEqual("hello");
    expect(customData["var2"]).toBeUndefined();
    expect(customData["var3"]).toBeUndefined();
    expect(customData["var4"]).toBeUndefined();
  });

  test("custom data set after LUX.send is sent in a separate beacon", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => LUX.addData("var1", "hello"))
    );

    const mainBeacon = luxRequests.getUrl(0)!;
    const cdBeacon = luxRequests.getUrl(1)!;
    const customData = parseNestedPairs(getSearchParam(cdBeacon, "CD"));

    expect(mainBeacon.searchParams.get("CD")).toBeNull();
    expect(customData["var1"]).toEqual("hello");
    expect(cdBeacon.searchParams.get("HN")).toEqual("localhost");
    expect(cdBeacon.searchParams.get("PN")).toEqual("/default.html");
  });

  test("supplementary custom data beacons only contain data that has changed", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });

    // Main beacon 1
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("var1", "hello");
        LUX.addData("var2", "world");
        LUX.send();
      })
    );

    // Custom data baecon 1
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("var2", "doggo");
      })
    );

    // Main beacon 2
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.addData("var2", "everyone");
        LUX.send();
      })
    );

    // Custom data beacon 2
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("var3", "foo");
      })
    );

    // Custom data beacon 3
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("var3", "foo");
        LUX.addData("var1", "greetings");
      })
    );

    const mainBeacon1Data = parseNestedPairs(getSearchParam(luxRequests.getUrl(0)!, "CD"));
    const cdBeacon1Data = parseNestedPairs(getSearchParam(luxRequests.getUrl(1)!, "CD"));
    const mainBeacon2Data = parseNestedPairs(getSearchParam(luxRequests.getUrl(2)!, "CD"));
    const cdBeacon2Data = parseNestedPairs(getSearchParam(luxRequests.getUrl(3)!, "CD"));
    const cdBeacon3Data = parseNestedPairs(getSearchParam(luxRequests.getUrl(4)!, "CD"));

    expect(mainBeacon1Data["var1"]).toEqual("hello");
    expect(mainBeacon1Data["var2"]).toEqual("world");
    expect(mainBeacon1Data["var3"]).toBeUndefined();

    expect(cdBeacon1Data["var1"]).toBeUndefined();
    expect(cdBeacon1Data["var2"]).toEqual("doggo");
    expect(cdBeacon1Data["var3"]).toBeUndefined();

    expect(mainBeacon2Data["var1"]).toEqual("hello");
    expect(mainBeacon2Data["var2"]).toEqual("everyone");
    expect(mainBeacon2Data["var3"]).toBeUndefined();

    expect(cdBeacon2Data["var1"]).toBeUndefined();
    expect(cdBeacon2Data["var2"]).toBeUndefined();
    expect(cdBeacon2Data["var3"]).toEqual("foo");

    expect(cdBeacon3Data["var1"]).toEqual("greetings");
    expect(cdBeacon3Data["var2"]).toBeUndefined();
    expect(cdBeacon3Data["var3"]).toBeUndefined();
  });

  test("custom data is retained between SPA pages", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.addData("var1", "hello");
        LUX.addData("var2", "world");
        LUX.send();
      })
    );

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.addData("var2", "doggo");
        LUX.send();
      })
    );

    const beacon = luxRequests.getUrl(1)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["var1"]).toEqual("hello");
    expect(customData["var2"]).toEqual("doggo");
  });

  test("custom data is not retained between full page navigations", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.addData('var1', 'hello');", {
      waitUntil: "networkidle",
    });

    let beacon = luxRequests.getUrl(0)!;
    const customData = parseNestedPairs(getSearchParam(beacon, "CD"));

    expect(customData["var1"]).toEqual("hello");

    await page.goto("/default.html", { waitUntil: "networkidle" });

    beacon = luxRequests.getUrl(1)!;

    expect(beacon.searchParams.get("CD")).toBeNull();
  });
});
