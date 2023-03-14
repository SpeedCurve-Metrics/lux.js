import { parseNestedPairs } from "../helpers/lux";

describe("LUX custom data", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  beforeEach(() => {
    luxRequests.reset();
  });

  test("only valid customer data is sent", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => {
      LUX.addData("stringVar", "hello");
      LUX.addData("emptyStringVar", "");
      LUX.addData("numberVar", 123);
      LUX.addData("numberZeroVar", 0);
      LUX.addData("booleanFalseVar", false);
      LUX.addData("booleanTrueVar", true);
      LUX.addData("objectVar", { key: "val" });
      LUX.addData("arrayVar", [1, 2, 3]);
      LUX.send();
    });

    const beacon = luxRequests.getUrl(0);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["stringVar"]).toEqual("hello");
    expect(customData["emptyStringVar"]).toEqual("");
    expect(customData["numberVar"]).toEqual("123");
    expect(customData["numberZeroVar"]).toEqual("0");
    expect(customData["booleanFalseVar"]).toEqual("false");
    expect(customData["booleanTrueVar"]).toEqual("true");
    expect(customData["objectVar"]).toBeUndefined();
    expect(customData["arrayVar"]).toBeUndefined();
  });

  test("reserved characters are removed from keys and value", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => {
      LUX.addData("var1", "|special,characters|");
      LUX.addData("var|2", "normal string");
      LUX.addData("var|,3", "special, string");
      LUX.send();
    });

    const beacon = luxRequests.getUrl(0);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["var1"]).toEqual("specialcharacters");
    expect(customData["var2"]).toEqual("normal string");
    expect(customData["var3"]).toEqual("special string");
  });

  test("custom data set before LUX.send is sent with the main beacon", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate("LUX.addData('var1', 'hello')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["var1"]).toEqual("hello");
  });

  test("custom data can be removed", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => {
      LUX.addData("var1", "hello");
      LUX.addData("var2", "world");
      LUX.addData("var3", "and");
      LUX.addData("var4", "others");
      LUX.addData("var2", null);
      LUX.addData("var3", undefined);
      LUX.addData("var4");
      LUX.send();
    });

    const beacon = luxRequests.getUrl(0);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["var1"]).toEqual("hello");
    expect(customData["var2"]).toBeUndefined();
    expect(customData["var3"]).toBeUndefined();
    expect(customData["var4"]).toBeUndefined();
  });

  test("custom data set after LUX.send is sent in a separate beacon", async () => {
    await navigateTo("/default.html");
    await page.evaluate("LUX.addData('var1', 'hello')");
    await waitForNetworkIdle();

    const mainBeacon = luxRequests.getUrl(0);
    const cdBeacon = luxRequests.getUrl(1);
    const customData = parseNestedPairs(cdBeacon.searchParams.get("CD"));

    expect(mainBeacon.searchParams.get("CD")).toBeNull();
    expect(customData["var1"]).toEqual("hello");
    expect(cdBeacon.searchParams.get("HN")).toEqual("localhost");
    expect(cdBeacon.searchParams.get("PN")).toEqual("/default.html");
  });

  test("supplementary custom data beacons only contain data that has changed", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");

    // Main beacon 1
    await page.evaluate(() => {
      LUX.addData("var1", "hello");
      LUX.addData("var2", "world");
      LUX.send();
    });

    await waitForNetworkIdle();

    // Custom data baecon 1
    await page.evaluate(() => {
      LUX.addData("var2", "doggo");
    });

    await waitForNetworkIdle();

    // Main beacon 2
    await page.evaluate(() => {
      LUX.init();
      LUX.addData("var2", "everyone");
      LUX.send();
    });

    await waitForNetworkIdle();

    // Custom data beacon 2
    await page.evaluate(() => {
      LUX.addData("var3", "foo");
    });

    await waitForNetworkIdle();

    // Custom data beacon 3
    await page.evaluate(() => {
      LUX.addData("var3", "foo");
      LUX.addData("var1", "greetings");
    });

    await waitForNetworkIdle();

    const mainBeacon1Data = parseNestedPairs(luxRequests.getUrl(0).searchParams.get("CD"));
    const cdBeacon1Data = parseNestedPairs(luxRequests.getUrl(1).searchParams.get("CD"));
    const mainBeacon2Data = parseNestedPairs(luxRequests.getUrl(2).searchParams.get("CD"));
    const cdBeacon2Data = parseNestedPairs(luxRequests.getUrl(3).searchParams.get("CD"));
    const cdBeacon3Data = parseNestedPairs(luxRequests.getUrl(4).searchParams.get("CD"));

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

  test("custom data is retained between SPA pages", async () => {
    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    await page.evaluate(() => {
      LUX.addData("var1", "hello");
      LUX.addData("var2", "world");
      LUX.send();
      LUX.init();
      LUX.addData("var2", "doggo");
      LUX.send();
    });

    const beacon = luxRequests.getUrl(1);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["var1"]).toEqual("hello");
    expect(customData["var2"]).toEqual("doggo");
  });

  test("custom data is not retained between full page navigations", async () => {
    await navigateTo("/default.html?injectScript=LUX.addData('var1', 'hello');");

    let beacon = luxRequests.getUrl(0);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["var1"]).toEqual("hello");

    await navigateTo("/default.html");

    beacon = luxRequests.getUrl(1);

    expect(beacon.searchParams.get("CD")).toBeNull();
  });
});
