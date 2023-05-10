import { test, expect } from "@playwright/test";
import { getSearchParam, parseNestedPairs } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX interaction element attribution", () => {
  test("button with ID should use its own ID", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator("#button-with-id").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("button-with-id");
  });

  test("button without ID should use the button text if it has some", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator(".button-no-id").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("Button without ID");
  });

  test("button without ID should use the nearest ancestor ID if it has no text", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator(".button-no-text").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("content");
  });

  test("span inside a button should use the button text", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator(".span-in-button").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("Button with span");
  });

  test("link with ID should use its own ID", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator("#link-with-id").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("link-with-id");
  });

  test("link without ID should use the link text if it has some", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator(".link-no-id").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("Link without ID");
  });

  test("span with ID should use its own ID", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator("#span-with-id").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("span-with-id");
  });

  test("span without ID should use the nearest ancestor ID", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator(".span-no-id").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("content");
  });

  test("element with data-sctrack and ID should use data-sctrack", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator(".nav-link-sctrack").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("nav-link-with-sctrack");
  });

  test("element whose ancestor has data-sctrack should use data-sctrack even with its own ID", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator("#nav-link-with-id").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("navigation");
  });

  test("link with no text or ID should use the ancestor's data-sctrack attribute", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator(".nav-link-no-text-or-id").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toEqual("navigation");
  });

  test("element without any identifying attributes on itself or ancestors should not have an identifier", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/interaction.html?injectScript=LUX.auto=false;");
    await page.locator(".footer-span").click();
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));
    const ixBeacon = luxRequests.getUrl(0)!;
    const ixMetrics = parseNestedPairs(getSearchParam(ixBeacon, "IX"));
    expect(ixMetrics.ci).toBeUndefined();
  });
});
