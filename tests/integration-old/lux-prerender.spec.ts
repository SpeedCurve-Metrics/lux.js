import { test, expect } from "@playwright/test";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX prerender support", () => {
  const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

  beforeEach(() => {
    luxRequests.reset();
  });

  test.only("pages loaded by prerender speculation rules do not trigger beacons", async () => {
    await page.goto("/prerender-index.html", { waitUntil: "networkidle" });

    expect(luxRequests.count()).toEqual(1);
  });

  test("LUX.autoWhenHidden=true overrides the default behaviour and sends the beacon on prerendered pages", async ({
    page,
  }) => {
    await page.goto("/prerender-index.html?injectScript=LUX.autoWhenHidden=true", {
      waitUntil: "networkidle",
    });
    await page.waitForLoadState("networkidle");

    expect(luxRequests.count()).toEqual(2);
  });
});
