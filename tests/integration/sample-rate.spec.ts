import { test, expect } from "@playwright/test";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX beacon sample rate", () => {
  test("default sample rate is 100%", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    // UID ending in 20
    await page.goto("/default.html?injectScript=document.cookie=`lux_uid=${Date.now()%2B'20'}`;", {
      waitUntil: "networkidle",
    });

    // UID ending in 50
    await page.goto("/default.html?injectScript=document.cookie=`lux_uid=${Date.now()%2B'50'}`;", {
      waitUntil: "networkidle",
    });

    // UID ending in 70
    await page.goto("/default.html?injectScript=document.cookie=`lux_uid=${Date.now()%2B'70'}`;", {
      waitUntil: "networkidle",
    });

    // UID ending in 99
    await page.goto("/default.html?injectScript=document.cookie=`lux_uid=${Date.now()%2B'99'}`;", {
      waitUntil: "networkidle",
    });

    expect(luxRequests.count()).toEqual(4);
  });

  test("sample rate can be set with LUX.samplerate", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    // 50% sample rate, UID ending in 20. Will be sampled.
    await page.goto(
      "/default.html?injectScript=LUX.samplerate=50;document.cookie=`lux_uid=${Date.now()%2B'20'}`;",
      {
        waitUntil: "networkidle",
      },
    );

    // 50% sample rate, UID ending in 49. Will be sampled.
    await page.goto(
      "/default.html?injectScript=LUX.samplerate=50;document.cookie=`lux_uid=${Date.now()%2B'49'}`;",
      {
        waitUntil: "networkidle",
      },
    );

    // 50% sample rate, UID ending in 50. Will be not sampled.
    await page.goto(
      "/default.html?injectScript=LUX.samplerate=50;document.cookie=`lux_uid=${Date.now()%2B'50'}`;",
      {
        waitUntil: "networkidle",
      },
    );

    // 50% sample rate, UID ending in 70. Will not be sampled.
    await page.goto(
      "/default.html?injectScript=LUX.samplerate=50;document.cookie=`lux_uid=${Date.now()%2B'70'}`;",
      {
        waitUntil: "networkidle",
      },
    );

    expect(luxRequests.count()).toEqual(2);
  });
});
