import { test, expect } from "@playwright/test";
import { getSearchParam, parseUserTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("LUX beacon request", () => {
  test("beacon is sent with a GET request", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");

    await page.goto("/default.html", { waitUntil: "networkidle" });

    expect(luxRequests.count()).toEqual(1);
    expect(luxRequests.get(0)!.method()).toEqual("GET");
  });

  test("beacon is split into multiple requests when there are too many user timing entries", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate(() => {
      new Array(30).fill(null).forEach((_, i) => {
        performance.mark(`ut-mark-${i}`);
      });
    });
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()), 2);

    expect(luxRequests.count()).toEqual(2);

    const beacon1 = luxRequests.getUrl(0)!;
    const beacon2 = luxRequests.getUrl(1)!;
    const UT1 = parseUserTiming(getSearchParam(beacon1, "UT"));
    const UT2 = parseUserTiming(getSearchParam(beacon2, "UT"));

    // Test that the number of user timing entries in each beacon is what we expect
    expect(Object.keys(UT1).length).toEqual(20);
    expect(Object.keys(UT2).length).toEqual(10);

    // Check that the supplementary beacon contains all of the demographic data
    expect(beacon2.searchParams.get("l")).toEqual("LUX default test page");
    expect(beacon2.searchParams.get("HN")).toEqual("localhost");
    expect(beacon2.searchParams.get("PN")).toEqual("/default.html");
  });

  test("maximum user timing entries is configurable via LUX.maxBeaconUTEntries", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await luxRequests.waitForMatchingRequest(
      () =>
        page.evaluate(() => {
          LUX.maxBeaconUTEntries = 10;

          new Array(30).fill(null).forEach((_, i) => {
            performance.mark(`ut-mark-${i}`);
          });

          LUX.send();
        }),
      3
    );

    expect(luxRequests.count()).toEqual(3);

    luxRequests.reset();
    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        LUX.init();
        LUX.maxBeaconUTEntries = 50;

        new Array(30).fill(null).forEach((_, i) => {
          performance.mark(`ut-mark-${i}`);
        });

        LUX.send();
      })
    );

    expect(luxRequests.count()).toEqual(1);
  });

  test("beacon is split into multiple requests when the URL is too long", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    page.on("console", (msg) => console.log("PAGE LOG:", msg.text()));

    // The URL length limit is about 8KB. We create multiple long UT marks to go over the limit
    const longString = new Array(3500).fill("A").join("");

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate((longString) => {
      performance.mark(`${longString}-1`, { startTime: performance.now() - 20 });
      performance.mark(`${longString}-2`, { startTime: performance.now() - 15 });
    }, longString);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    expect(luxRequests.count()).toEqual(1);

    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.toString()).toContain(`${longString}-1`);
    expect(beacon.toString()).toContain(`${longString}-2`);
    luxRequests.reset();

    await page.evaluate(() => LUX.init());
    await page.waitForTimeout(50);
    await page.evaluate((longString) => {
      performance.mark(`${longString}-1`, { startTime: performance.now() - 20 });
      performance.mark(`${longString}-2`, { startTime: performance.now() - 15 });
      performance.mark(`${longString}-3`, { startTime: performance.now() - 10 });
    }, longString);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    expect(luxRequests.count()).toEqual(2);

    const beacon1 = luxRequests.getUrl(0)!;
    const beacon2 = luxRequests.getUrl(1)!;

    expect(beacon1.toString()).toContain(`${longString}-1`);
    expect(beacon1.toString()).toContain(`${longString}-2`);
    expect(beacon1.toString()).not.toContain(`${longString}-3`);
    expect(beacon2.toString()).not.toContain(`${longString}-1`);
    expect(beacon2.toString()).not.toContain(`${longString}-2`);
    expect(beacon2.toString()).toContain(`${longString}-3`);
  });

  test("at least one user timing entry is sent even when it goes over the URL length limit", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    const longString = new Array(9000).fill("A").join("");

    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    await page.evaluate(`performance.mark("${longString}")`);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.send()));

    expect(luxRequests.count()).toEqual(1);

    const beacon = luxRequests.getUrl(0)!;

    expect(beacon.toString()).toContain(longString);
  });
});
