import { getElapsedMs, parseNestedPairs } from "../helpers/lux";

describe("LUX interaction", () => {
  test("click interaction metrics are gathered", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/interaction.html");
    const timeBeforeClick = await getElapsedMs(page);
    await page.click("#button-with-id");

    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    // Separate request for main beacon and interaction beacon
    expect(luxRequests.count()).toEqual(2);

    // Click time
    expect(parseInt(ixMetrics.c)).toBeGreaterThanOrEqual(timeBeforeClick);

    // Click attribution
    expect(ixMetrics.ci).toEqual("button-with-id");

    // Click coordinates
    expect(parseInt(ixMetrics.cx)).toBeGreaterThan(0);
    expect(parseInt(ixMetrics.cy)).toBeGreaterThan(0);
  });

  test("keypress interaction metrics are gathered", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/interaction.html");
    const timeBeforeKeyPress = await getElapsedMs(page);
    const button = await page.$("#button-with-id");
    await button.press("Enter");

    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    // Key press time
    expect(parseInt(ixMetrics.k)).toBeGreaterThanOrEqual(timeBeforeKeyPress);

    // Key press attribution
    expect(ixMetrics.ki).toEqual("button-with-id");
  });

  test("only high level metrics are sent in the interaction beacon", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/interaction.html");
    await page.click("#button-with-js");

    const ixBeacon = luxRequests.getUrl(1);

    expect(ixBeacon.searchParams.get("HN")).toEqual("localhost");
    expect(ixBeacon.searchParams.get("PN")).toEqual("/interaction.html");
  });

  test("FID is gathered for clicks", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/interaction.html?blockFor=20");
    await page.click("#button-with-js");

    const ixBeacon = luxRequests.getUrl(1);

    expect(parseInt(ixBeacon.searchParams.get("FID"))).toBeGreaterThanOrEqual(0);
  });

  test("FID is gathered for keypress", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/interaction.html?blockFor=20");
    const button = await page.$("#button-with-js");
    await button.press("Enter");

    const ixBeacon = luxRequests.getUrl(1);

    expect(parseInt(ixBeacon.searchParams.get("FID"))).toBeGreaterThanOrEqual(0);
  });

  test("gather IX metrics in a SPA", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/interaction.html?injectScript=LUX.auto=false;");
    await page.evaluate("LUX.send()");
    await page.waitForTimeout(100);

    await page.evaluate("LUX.init()");
    await page.waitForTimeout(20);
    await page.click("#button-with-id");
    await page.evaluate("LUX.send()");

    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    expect(parseInt(ixMetrics.c)).toBeGreaterThan(20);
    expect(parseInt(ixMetrics.c)).toBeLessThan(100);
    expect(parseInt(ixBeacon.searchParams.get("FID"))).toBeGreaterThanOrEqual(0);
  });

  test("mousedown handler doesn't throw errors when the event target is not an Element", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/interaction.html");
    await page.evaluate("window.dispatchEvent(new MouseEvent('mousedown'))");
    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    expect(parseInt(ixMetrics.c)).toBeGreaterThanOrEqual(0);
  });

  test("keydown handler doesn't throw errors when the event target is not an Element", async () => {
    const luxRequests = requestInterceptor.createRequestMatcher("/beacon/");
    await navigateTo("/interaction.html");
    await page.evaluate("window.dispatchEvent(new MouseEvent('keydown'))");
    const ixBeacon = luxRequests.getUrl(1);
    const ixMetrics = parseNestedPairs(ixBeacon.searchParams.get("IX"));

    expect(parseInt(ixMetrics.k)).toBeGreaterThanOrEqual(0);
  });
});
