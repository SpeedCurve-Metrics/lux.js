import { parseNestedPairs } from "../helpers/lux";

describe("LUX custom data", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  beforeEach(() => {
    luxRequests.reset();
  });

  test("only valid customer data is sent", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.addData('stringVar', 'hello')");
    await page.evaluate("LUX.addData('emptyStringVar', '')");
    await page.evaluate("LUX.addData('numberVar', 123)");
    await page.evaluate("LUX.addData('numberZeroVar', 0)");
    await page.evaluate("LUX.addData('booleanFalseVar', false)");
    await page.evaluate("LUX.addData('booleanTrueVar', true)");
    await page.evaluate("LUX.addData('objectVar', { key: 'val' })");
    await page.evaluate("LUX.addData('arrayVar', [1, 2, 3])");
    await page.evaluate("LUX.send()");

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

  test("custom data set before LUX.send is sent with the main beacon", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.addData('var1', 'hello')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(0);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["var1"]).toEqual("hello");
  });

  test("custom data set after LUX.send is sent in a separate beacon", async () => {
    await navigateTo("http://localhost:3000/default.html");
    await page.evaluate("LUX.addData('var1', 'hello')");
    await page.waitForNetworkIdle();

    const mainBeacon = luxRequests.getUrl(0);
    const cdBeacon = luxRequests.getUrl(1);
    const customData = parseNestedPairs(cdBeacon.searchParams.get("CD"));

    expect(mainBeacon.searchParams.get("CD")).toBeNull();
    expect(customData["var1"]).toEqual("hello");
    expect(cdBeacon.searchParams.get("HN")).toEqual("localhost");
    expect(cdBeacon.searchParams.get("PN")).toEqual("/default.html");

    // Pathname should be the last query parameter
    const lastQueryParam = [...cdBeacon.searchParams.entries()].pop();

    expect(lastQueryParam).toEqual(["PN", "/default.html"]);
  });

  test("custom data is retained between SPA pages", async () => {
    await navigateTo("http://localhost:3000/auto-false.html");
    await page.evaluate("LUX.addData('var1', 'hello')");
    await page.evaluate("LUX.addData('var2', 'world')");
    await page.evaluate("LUX.send()");
    await page.evaluate("LUX.init()");
    await page.evaluate("LUX.addData('var2', 'doggo')");
    await page.evaluate("LUX.send()");

    const beacon = luxRequests.getUrl(1);
    const customData = parseNestedPairs(beacon.searchParams.get("CD"));

    expect(customData["var1"]).toEqual("hello");
    expect(customData["var2"]).toEqual("doggo");
  });
});
