import { LogEvent } from "../../src/logger";

describe("LUX logging", () => {
  test("logs can be retrieved", async () => {
    let logs = [];

    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    logs = await page.evaluate("LUX.getDebug()");

    expect(logs[0][1]).toEqual(LogEvent.EvaluationStart);
    expect(logs[logs.length - 1][1]).toEqual(LogEvent.EvaluationEnd);

    await page.evaluate("LUX.send()");
    logs = await page.evaluate("LUX.getDebug()");

    expect(logs[logs.length - 1][1]).toEqual(LogEvent.MainBeaconSent);
  });
});
