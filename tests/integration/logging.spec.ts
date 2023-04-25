import { test, expect } from "@playwright/test";
import { LogEvent } from "../../src/logger";

test.describe("LUX logging", () => {
  test("logs can be retrieved", async ({ page }) => {
    await page.goto("/default.html?injectScript=LUX.auto=false;", { waitUntil: "networkidle" });
    let logs = await page.evaluate(() => LUX.getDebug());
    let eventNames = logs.map((event) => event[1]);

    expect(eventNames[0]).toEqual(LogEvent.EvaluationStart);
    expect(eventNames).toContain(LogEvent.EvaluationEnd);
    expect(eventNames).not.toContain(LogEvent.MainBeaconSent);

    await page.evaluate(() => LUX.send());
    logs = await page.evaluate(() => LUX.getDebug());
    eventNames = logs.map((event) => event[1]);

    expect(eventNames).toContain(LogEvent.MainBeaconSent);
  });
});
