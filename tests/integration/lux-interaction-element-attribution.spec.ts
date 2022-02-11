import { parseNestedPairs } from "../helpers/lux";

describe("LUX interaction element attribution", () => {
  const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");

  beforeAll(async () => {
    await navigateTo("http://localhost:3000/interaction.html?injectScript=LUX.auto=false;");
  });

  afterEach(async () => {
    luxRequests.reset();
    await page.evaluate("LUX.init()");
  });

  test("button with ID should use its own ID", async () => {
    await page.click("#button-with-id");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("button-with-id");
  });

  test("button without ID should use the button text if it has some", async () => {
    await page.click(".button-no-id");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("Button without ID");
  });

  test("button without ID should use the nearest ancestor ID if it has no text", async () => {
    await page.click(".button-no-text");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("content");
  });

  test("link with ID should use its own ID", async () => {
    await page.click("#link-with-id");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("link-with-id");
  });

  test("link without ID should use the link text if it has some", async () => {
    await page.click(".link-no-id");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("Link without ID");
  });

  test("span with ID should use its own ID", async () => {
    await page.click("#span-with-id");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("span-with-id");
  });

  test("span without ID should use the nearest ancestor ID", async () => {
    await page.click(".span-no-id");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("content");
  });

  test("child of an element with data-sctrack should use its own ID if it has one", async () => {
    await page.click("#nav-link-with-id");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("nav-link-with-id");
  });

  test("child of an element with data-sctrack should use the data-sctrack attribute if it has no ID", async () => {
    await page.click(".nav-link-no-id");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toEqual("navigation");
  });

  test("element without any identifying attributes on itself or ancestors should not have an identifier", async () => {
    await page.click(".footer-span");
    await page.evaluate("LUX.send()");
    const ixBeacon = luxRequests.getUrl(0);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));
    expect(ixMetrics.ci).toBeUndefined();
  });
});
