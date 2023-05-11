import { test, expect } from "@playwright/test";
import { getElapsedMs, getSearchParam, parseNestedPairs } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX interaction", () => {
  test("click interaction metrics are gathered", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html");
    await luxRequests.waitForMatchingRequest();
    const timeBeforeClick = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.locator("#button-with-id").click());
    const ixBeacon = luxRequests.getUrl(1)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));

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

  test("keypress interaction metrics are gathered", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html", { waitUntil: "networkidle" });
    const timeBeforeKeyPress = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.locator("#button-with-id").press("Enter"));

    const ixBeacon = luxRequests.getUrl(1)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));

    // Key press time
    expect(parseInt(ixMetrics.k)).toBeGreaterThanOrEqual(timeBeforeKeyPress);

    // Key press attribution
    expect(ixMetrics.ki).toEqual("button-with-id");
  });

  test("only high level metrics are sent in the interaction beacon", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.locator("#button-with-js").click());

    const ixBeacon = luxRequests.getUrl(1)!;

    expect(ixBeacon.searchParams.get("HN")).toEqual("localhost");
    expect(ixBeacon.searchParams.get("PN")).toEqual("/interaction.html");
    expect(ixBeacon.searchParams.get("PS")).toBeNull();
    expect(ixBeacon.searchParams.get("NT")).toBeNull();
  });

  test("FID and INP are gathered for clicks", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?blockFor=100");

    // Wait for the main beacon
    await luxRequests.waitForMatchingRequest();

    // Then wait for the interaction beacon after clicking
    await luxRequests.waitForMatchingRequest(() => page.locator("#button-with-js").click(), 2);

    const mainBeacon = luxRequests.getUrl(0)!;
    const ixBeacon = luxRequests.getUrl(1)!;

    expect(mainBeacon.searchParams.get("FID")).toBeNull();
    expect(mainBeacon.searchParams.get("INP")).toBeNull();
    expect(parseInt(getSearchParam(ixBeacon, "FID"))).toBeGreaterThanOrEqual(0);

    if (browserName === "webkit") {
      // INP not supported in webkit
      expect(ixBeacon.searchParams.get("INP")).toBeNull();
    } else {
      expect(parseInt(getSearchParam(ixBeacon, "INP"))).toBeGreaterThanOrEqual(0);
    }
  });

  test("FID and INP are gathered for keypress", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?blockFor=50", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() => page.locator("#button-with-js").press("Enter"));

    const mainBeacon = luxRequests.getUrl(0)!;
    const ixBeacon = luxRequests.getUrl(1)!;

    expect(mainBeacon.searchParams.get("FID")).toBeNull();
    expect(mainBeacon.searchParams.get("INP")).toBeNull();
    expect(parseInt(getSearchParam(ixBeacon, "FID"))).toBeGreaterThanOrEqual(0);

    if (browserName === "webkit") {
      // INP not supported in webkit
      expect(ixBeacon.searchParams.get("INP")).toBeNull();
    } else {
      expect(parseInt(getSearchParam(ixBeacon, "INP"))).toBeGreaterThanOrEqual(0);
    }
  });

  test("gather IX metrics in a SPA", async ({ page, browserName }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?blockFor=20&injectScript=LUX.auto=false;");
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    await page.waitForTimeout(100);

    // Note: we use force: true for the click operation because we are making assertions about the
    // interaction time that is recorded. Setting force: true disables Playwright's accountability
    // checks, which can add delays before the actual click operation is performed.
    const timeBeforeInit = await getElapsedMs(page);
    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(20);
    await page.locator("#button-with-js").click({ force: true });
    const timeAfterClick = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(20);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const secondPageBeacon = luxRequests.getUrl(1)!;
    const thirdPageBeacon = luxRequests.getUrl(2)!;
    const ixMetrics = parseNestedPairs(getSearchParam(secondPageBeacon, "IX"));

    expect(parseInt(ixMetrics.c)).toBeGreaterThan(20);
    expect(parseInt(ixMetrics.c)).toBeLessThanOrEqual(timeAfterClick - timeBeforeInit);
    expect(parseInt(getSearchParam(secondPageBeacon, "FID"))).toBeGreaterThanOrEqual(0);

    if (browserName === "webkit") {
      // INP not supported in webkit
      expect(secondPageBeacon.searchParams.get("INP")).toBeNull();
    } else {
      expect(parseInt(getSearchParam(secondPageBeacon, "INP"))).toBeGreaterThanOrEqual(0);
    }

    // The third beacon should have no IX metrics
    expect(thirdPageBeacon.searchParams.get("FID")).toBeNull();
    expect(thirdPageBeacon.searchParams.get("INP")).toBeNull();
  });

  test("mousedown handler doesn't throw errors when the event target is not an Element", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => window.dispatchEvent(new MouseEvent("mousedown")))
    );
    const ixBeacon = luxRequests.getUrl(1)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));

    expect(parseInt(ixMetrics.c)).toBeGreaterThanOrEqual(0);
  });

  test("keydown handler doesn't throw errors when the event target is not an Element", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => window.dispatchEvent(new MouseEvent("keydown")))
    );
    const ixBeacon = luxRequests.getUrl(1)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));

    expect(parseInt(ixMetrics.k)).toBeGreaterThanOrEqual(0);
  });
});
