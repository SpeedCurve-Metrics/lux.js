import { test, expect } from "@playwright/test";
import { getSearchParam, parseUserTiming } from "../helpers/lux";
import RequestInterceptor from "../request-interceptor";

test.describe("Late user timing", () => {
  test("late user timing marks and measures are not sent by default", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    await page.goto("/user-timing.html");
    await luxRequests.waitForMatchingRequest();
    await page.evaluate(() => {
      performance.mark("late-mark");
      performance.measure("late-measure");
    });
    const beacon = luxRequests.getUrl(0)!;
    const UT = parseUserTiming(getSearchParam(beacon, "UT"));

    expect(luxRequests.count()).toEqual(1);
    expect(Object.keys(UT).length).toEqual(3);
    expect(UT["late-mark"]).toBeUndefined();
    expect(UT["late-measure"]).toBeUndefined();
  });

  test("LUX.lateUserTiming controls which user timing can be sent after the main beacon", async ({
    page,
  }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/beacon/");
    page.on("console", (msg) => console.log(msg.text()));
    await page.goto(
      `/user-timing.html?injectScript=LUX.lateUserTiming=["late-mark",/^allowed-.*/];`
    );
    await luxRequests.waitForMatchingRequest();

    expect(luxRequests.count()).toEqual(1);

    await luxRequests.waitForMatchingRequest(() =>
      page.evaluate(() => {
        performance.mark("late-mark");
        performance.mark("late-mark-2");
        performance.measure("late-measure");
        performance.mark("not-allowed-1");
        performance.measure("allowed-1");
        performance.mark("allowed-again-wee");
      })
    );

    expect(luxRequests.count()).toEqual(2);

    const mainBeacon = luxRequests.getUrl(0)!;
    const lateBeacon = luxRequests.getUrl(1)!;
    const mainUT = parseUserTiming(getSearchParam(mainBeacon, "UT"));
    const lateUT = parseUserTiming(getSearchParam(lateBeacon, "UT"));

    expect(Object.keys(mainUT).length).toEqual(3);
    expect(Object.keys(lateUT).length).toEqual(3);
    expect(lateUT["late-mark"].startTime).toBeGreaterThanOrEqual(0);
    expect(lateUT["allowed-1"].startTime).toBeGreaterThanOrEqual(0);
    expect(lateUT["allowed-again-wee"].startTime).toBeGreaterThanOrEqual(0);
    expect(lateUT["late-mark-2"]).toBeUndefined();
    expect(lateUT["late-measure"]).toBeUndefined();
    expect(lateUT["not-allowed-1"]).toBeUndefined();
  });
});
