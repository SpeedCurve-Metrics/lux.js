import { test, expect } from "@playwright/test";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX customer ID", () => {
  test("customer ID from the script URL is preferred", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.customerid=12345", {
      waitUntil: "networkidle",
    });
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("id")).toEqual("10001");
  });

  test("multiple lux.js scripts can run on the same page", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html", {
      waitUntil: "networkidle",
    });

    const beacon1 = luxRequests.getUrl(0)!;
    expect(beacon1.searchParams.get("id")).toEqual("10001");

    await luxRequests.waitForMatchingRequest(() =>
      page.addScriptTag({ url: "/js/lux.js?id=34567" }),
    );

    const beacon2 = luxRequests.getUrl(1)!;
    expect(beacon2.searchParams.get("id")).toEqual("34567");
  });

  test("customer ID from the injected script is used when no script URL ID", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/self-hosted.html?injectScript=LUX.customerid=12345", {
      waitUntil: "networkidle",
    });
    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.searchParams.get("id")).toEqual("12345");
  });
});
