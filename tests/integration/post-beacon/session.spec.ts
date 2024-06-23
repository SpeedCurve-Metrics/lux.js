import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { SESSION_COOKIE_NAME as uid } from "../../../src/cookie";
import RequestInterceptor from "../../request-interceptor";

test.describe("LUX user sessions", () => {
  test("the session ID is the same across multiple page views", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/images.html", { waitUntil: "networkidle" });
    await page.goto("/");
    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const sessionId = b.sessionId;

    expect(sessionId.length).toBeGreaterThan(0);
    expect(b.pageId.length).toBeGreaterThan(0);

    await page.goto("/images.html", { waitUntil: "networkidle" });
    await page.goto("/");
    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;

    expect(b.sessionId).toEqual(sessionId);
  });

  test("the session ID is read from the lux_uid cookie", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    const sessionId = Date.now() + "999";
    await page.goto(`/images.html?injectScript=document.cookie="${uid}=${sessionId}";`, {
      waitUntil: "networkidle",
    });
    await page.goto("/");
    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;

    expect(b.sessionId).toEqual(sessionId);

    await page.goto("/images.html", { waitUntil: "networkidle" });
    await page.goto("/");
    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;

    expect(b.sessionId).toEqual(sessionId);
  });

  test("the session ID is rotated after it expires and is set for 30 minutes", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");

    // When we set the session ID like this, lux.js will refresh the expiry time to 30 minutes from
    // now. Since we want to test what happens when the cookie expires, we need to re-set the cookie
    // after the page loads, and give it a short expiry time.
    const sessionId = Date.now() + "999";
    await page.goto(`/images.html?injectScript=document.cookie="${uid}=${sessionId}";`, {
      waitUntil: "networkidle",
    });
    await page.evaluate(
      ([uid, sessionId]) => (document.cookie = `${uid}=${sessionId}; max-age=2`),
      [uid, sessionId],
    );
    await page.goto("/");

    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    expect(b.sessionId).toEqual(sessionId);

    await page.waitForTimeout(2000);
    await page.goto("/images.html", { waitUntil: "networkidle" });
    await page.goto("/");

    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.sessionId).not.toEqual(sessionId);
  });
});
