import { LogEvent } from "../../src/logger";

describe("LUX logging", () => {
  test("logs can be retrieved", async () => {
    let logs = [];
    let eventNames = [];

    await navigateTo("/default.html?injectScript=LUX.auto=false;");
    logs = await page.evaluate("LUX.getDebug()");
    eventNames = logs.map((event) => event[1]);

    expect(eventNames[0]).toEqual(LogEvent.EvaluationStart);
    expect(eventNames).toContain(LogEvent.EvaluationEnd);
    expect(eventNames).not.toContain(LogEvent.MainBeaconSent);

    await page.evaluate("LUX.send()");
    logs = await page.evaluate("LUX.getDebug()");
    eventNames = logs.map((event) => event[1]);

    expect(eventNames).toContain(LogEvent.MainBeaconSent);
  });
});
