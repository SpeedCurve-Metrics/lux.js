import { test, expect } from "@playwright/test";
import { BeaconPayload } from "../../../src/beacon";
import { getElapsedMs } from "../../helpers/lux";
import RequestInterceptor from "../../request-interceptor";

test.describe("User interaction metrics", () => {
  test("rage clicks are recorded", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/interaction.html");
    const timeBeforeClick = await getElapsedMs(page);
    await page.click("#button-with-id", {
      clickCount: 9,
      delay: 10,
    });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const rageClick = b.rage!;

    expect(rageClick.value).toEqual(9);
    expect(rageClick.startTime).toBeBetween(timeBeforeClick, timeBeforeClick + 1000);
    expect(rageClick.attribution.elementSelector).toEqual("#button-with-id");
    expect(rageClick.attribution.elementType).toEqual("BUTTON");
  });

  test("rage clicks are recorded in a SPA", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/interaction.html?injectScript=LUX.spaMode=true;");
    let timeBeforeClick = await getElapsedMs(page);
    await page.click("#button-with-id", {
      clickCount: 8,
      delay: 10,
    });

    const timeBeforeSoftNav = await getElapsedMs(page);
    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.startSoftNavigation()));
    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    let rageClick = b.rage!;

    expect(rageClick.value).toEqual(8);
    expect(rageClick.startTime).toBeBetween(timeBeforeClick, timeBeforeClick + 1000);
    expect(rageClick.attribution.elementSelector).toEqual("#button-with-id");

    // Soft navigation assertions
    timeBeforeClick = (await getElapsedMs(page)) - timeBeforeSoftNav;
    await page.click("#button-with-id-and-sctrack", {
      clickCount: 6,
      delay: 10,
    });

    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.startSoftNavigation()));
    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    rageClick = b.rage!;

    expect(rageClick.value).toEqual(6);
    expect(rageClick.startTime).toBeBetween(timeBeforeClick, timeBeforeClick + 1000);
    expect(rageClick.attribution.elementSelector).toEqual("button-prefer-sctrack");
  });

  test("clicks don't have to be on a specific element", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/interaction.html");
    await page.click("body", {
      position: { x: 50, y: 2000 },
      clickCount: 5,
      delay: 10,
    });
    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const rageClick = b.rage!;

    expect(rageClick.value).toEqual(5);
    expect(rageClick.attribution.elementSelector).toEqual("html>body");
    expect(rageClick.attribution.elementType).toEqual("BODY");
  });

  test("clicks must be within a certain radius", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/interaction.html?injectScript=LUX.spaMode=true;");

    // Make 3 clicks in one spot
    await page.click("body", {
      position: { x: 50, y: 50 },
      clickCount: 3,
      delay: 10,
    });

    // And 3 more clicks in a spot 100px away
    await page.click("body", {
      position: { x: 50, y: 150 },
      clickCount: 3,
      delay: 10,
    });

    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.startSoftNavigation()));
    let b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    expect(b.rage).toBeUndefined();

    // Make 3 clicks in one spot
    await page.click("body", {
      position: { x: 50, y: 50 },
      clickCount: 3,
      delay: 10,
    });

    // And 3 more clicks in a spot 40px away
    await page.click("body", {
      position: { x: 50, y: 90 },
      clickCount: 3,
      delay: 10,
    });

    await luxRequests.waitForMatchingRequest(() => page.evaluate(() => LUX.startSoftNavigation()));
    b = luxRequests.get(1)!.postDataJSON() as BeaconPayload;
    expect(b.rage!.value).toEqual(6);
  });

  test("clicks can be outside the radius if they are on the same target", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/interaction.html");

    const bigButton = page.locator("#big-button");

    // Click 3 times in the top-left of the button
    await bigButton.click({
      position: { x: 0, y: 0 },
      clickCount: 3,
      delay: 10,
    });

    // Click 3 times in the bottom-right of the button. Even though this is outside of the original
    // click radius, it should still count towards the rage click since it's the same target.
    await bigButton.click({
      position: { x: 200, y: 200 },
      clickCount: 3,
      delay: 10,
    });

    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const rageClick = b.rage!;

    expect(rageClick.value).toEqual(6);
    expect(rageClick.attribution.elementSelector).toEqual("#big-button");
    expect(rageClick.attribution.elementType).toEqual("BUTTON");
  });

  test("clicking elsewhere does not reset a previous rage click", async ({ page }) => {
    const luxRequests = new RequestInterceptor(page).createRequestMatcher("/store/");
    await page.goto("/interaction.html");

    await page.click("#button-with-id", {
      clickCount: 5,
      delay: 10,
    });

    await page.click("#link-with-id");

    await luxRequests.waitForMatchingRequest(() => page.goto("/"));
    const b = luxRequests.get(0)!.postDataJSON() as BeaconPayload;
    const rageClick = b.rage!;

    expect(rageClick.value).toEqual(5);
    expect(rageClick.attribution.elementSelector).toEqual("#button-with-id");
  });
});
