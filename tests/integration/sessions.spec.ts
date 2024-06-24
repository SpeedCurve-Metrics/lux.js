import { test, expect } from "@playwright/test";
import { SESSION_COOKIE_NAME as uid } from "../../src/cookie";
import { getSearchParam } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX user sessions", () => {
  test("the session ID is the same across multiple page views", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html", { waitUntil: "networkidle" });
    let beacon = luxRequests.getUrl(0)!;
    const sessionId = getSearchParam(beacon, "uid");

    expect(sessionId.length).toBeGreaterThan(0);
    expect(getSearchParam(beacon, "sid").length).toBeGreaterThan(0);

    await page.goto("/default.html", { waitUntil: "networkidle" });
    beacon = luxRequests.getUrl(1)!;

    expect(getSearchParam(beacon, "uid")).toEqual(sessionId);
  });

  test("the session ID is read from the lux_uid cookie", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const sessionId = Date.now() + "999";
    await page.goto(`/default.html?injectScript=document.cookie="${uid}=${sessionId}";`, {
      waitUntil: "networkidle",
    });
    let beacon = luxRequests.getUrl(0)!;

    expect(getSearchParam(beacon, "uid")).toEqual(sessionId);

    await page.goto("/default.html", { waitUntil: "networkidle" });
    beacon = luxRequests.getUrl(1)!;

    expect(getSearchParam(beacon, "uid")).toEqual(sessionId);
  });

  test("the session ID is rotated after it expires and is set for 30 minutes", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    // When we set the session ID like this, lux.js will refresh the expiry time to 30 minutes from
    // now. Since we want to test what happens when the cookie expires, we need to re-set the cookie
    // after the page loads, and give it a short expiry time.
    const sessionId = Date.now() + "999";
    await page.goto(`/default.html?injectScript=document.cookie="${uid}=${sessionId}";`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(
      ([uid, sessionId]) => (document.cookie = `${uid}=${sessionId}; max-age=1`),
      [uid, sessionId],
    );

    let beacon = luxRequests.getUrl(0)!;
    expect(getSearchParam(beacon, "uid")).toEqual(sessionId);

    await page.waitForTimeout(1500);
    await page.goto("/default.html", { waitUntil: "networkidle" });

    beacon = luxRequests.getUrl(1)!;
    expect(getSearchParam(beacon, "uid")).not.toEqual(sessionId);
  });
});
