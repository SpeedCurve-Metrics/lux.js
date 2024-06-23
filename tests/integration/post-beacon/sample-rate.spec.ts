import { test, expect } from "@playwright/test";
import { SESSION_COOKIE_NAME as uid } from "../../../src/cookie";
import RequestInterceptor from "../../request-interceptor";

test.describe("LUX beacon sample rate", () => {
  test("default sample rate is 100%", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");

    // UID ending in 20
    await page.goto(`/images.html?injectScript=document.cookie="${uid}=${Date.now() + "20"}";`, {
      waitUntil: "networkidle",
    });

    // UID ending in 50
    await page.goto(`/images.html?injectScript=document.cookie="${uid}=${Date.now() + "50"}";`, {
      waitUntil: "networkidle",
    });

    // UID ending in 70
    await page.goto(`/images.html?injectScript=document.cookie="${uid}=${Date.now() + "70"}";`, {
      waitUntil: "networkidle",
    });

    // UID ending in 99
    await page.goto(`/images.html?injectScript=document.cookie="${uid}=${Date.now() + "99"}";`, {
      waitUntil: "networkidle",
    });

    // One more navigation to send beacon from previous page.
    await page.goto("/");

    expect(luxRequests.count()).toEqual(4);
  });

  test("sample rate can be set with LUX.samplerate", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");

    // 50% sample rate, UID ending in 20. Will be sampled.
    await page.goto(
      `/images.html?injectScript=LUX.samplerate=50;document.cookie="${uid}=${Date.now() + "20"}";`,
      {
        waitUntil: "networkidle",
      },
    );

    // 50% sample rate, UID ending in 49. Will be sampled.
    await page.goto(
      `/images.html?injectScript=LUX.samplerate=50;document.cookie="${uid}=${Date.now() + "49"}";`,
      {
        waitUntil: "networkidle",
      },
    );

    // 50% sample rate, UID ending in 50. Will be not sampled.
    await page.goto(
      `/images.html?injectScript=LUX.samplerate=50;document.cookie="${uid}=${Date.now() + "50"}";`,
      {
        waitUntil: "networkidle",
      },
    );

    // 50% sample rate, UID ending in 70. Will not be sampled.
    await page.goto(
      `/images.html?injectScript=LUX.samplerate=50;document.cookie="${uid}=${Date.now() + "70"}";`,
      {
        waitUntil: "networkidle",
      },
    );

    // One more navigation to send beacon from previous page.
    await page.goto("/");

    expect(luxRequests.count()).toEqual(2);
  });
});
