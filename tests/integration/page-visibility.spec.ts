// TODO: Try and test for the bug where no beacon is sent on pages that are visible on load but hidden when send() happens
import { test, expect } from "@playwright/test";
import Flags from "../../src/flags";
import { getPageHiddenScript, setPageHidden } from "../helpers/browsers";
import { hasFlag } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("Page visibility", () => {
  test("not sending beacons on hidden pages by default", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const pageHiddenScript = getPageHiddenScript(true).replace(/\n/g, "");

    await page.goto(
      `/default.html?injectBeforeSnippet=${pageHiddenScript}&injectScript=LUX.minMeasureTime=300;`,
      {
        waitUntil: "networkidle",
      },
    );

    expect(luxRequests.count()).toEqual(0);
  });

  test("sending a beacon when a page is hidden before the minimum measure time and then shown again", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto(`/default.html?injectScript=LUX.minMeasureTime=300;`);
    await setPageHidden(page, true);
    await page.waitForTimeout(350);
    await setPageHidden(page, false);
    await page.waitForLoadState("networkidle");

    expect(luxRequests.count()).toEqual(1);
    expect(hasFlag(luxRequests.getUrl(0)!, Flags.VisibilityStateNotVisible)).toBe(false);
  });

  test("sending a beacon when a hidden page is shown before the beacon is sent", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const pageHiddenScript = getPageHiddenScript(true).replace(/\n/g, "");

    await page.goto(
      `/default.html?injectBeforeSnippet=${pageHiddenScript}&injectScript=LUX.minMeasureTime=300;`,
    );
    await setPageHidden(page, false);
    await page.waitForLoadState("networkidle");

    expect(luxRequests.count()).toEqual(1);
    expect(hasFlag(luxRequests.getUrl(0)!, Flags.VisibilityStateNotVisible)).toBe(false);
  });

  test("sending beacons on hidden pages when LUX.trackHiddenPages=true", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const pageHiddenScript = getPageHiddenScript(true).replace(/\n/g, "");

    await page.goto(
      `/default.html?injectBeforeSnippet=${pageHiddenScript}&injectScript=LUX.minMeasureTime=300;LUX.trackHiddenPages=true;`,
      {
        waitUntil: "networkidle",
      },
    );

    expect(luxRequests.count()).toEqual(1);
    expect(hasFlag(luxRequests.getUrl(0)!, Flags.VisibilityStateNotVisible)).toBe(true);
  });
});
