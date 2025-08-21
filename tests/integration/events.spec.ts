import { test, expect } from "@playwright/test";
import { getSearchParam } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX events", () => {
  test("new_page_id", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.auto=false;LUX.on('new_page_id', (id) => window.page_id = id);",
      { waitUntil: "networkidle" },
    );
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const firstPageId = await page.evaluate(() => window.page_id);
    const firstBeacon = luxRequests.getUrl(0)!;
    expect(firstPageId).toEqual(getSearchParam(firstBeacon, "sid"));

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.send();
      }),
    );

    const secondBeacon = luxRequests.getUrl(1)!;
    const secondPageId = await page.evaluate(() => window.page_id);
    expect(secondPageId).toEqual(getSearchParam(secondBeacon, "sid"));
  });

  test("beacon", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto(
      "/default.html?injectScript=LUX.auto=false;LUX.on('beacon', (url) => window.beacon_url = url);",
      { waitUntil: "networkidle" },
    );
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    const beacon = luxRequests.getUrl(0)!;
    let beaconUrl = await page.evaluate(() => window.beacon_url);

    // We don't encode the Delivery Type parameter before sending the beacon, but Chromium seems to
    // check that everything is encoded before making the actual request. This is a small hack to
    // allow us to compare the strings.
    beaconUrl = beaconUrl.replace("dt(empty string)_", "dt(empty%20string)_");

    expect(beaconUrl).toEqual(beacon.href);
  });
});
