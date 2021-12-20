import { LogEvent } from "../../src/logger";

describe("LUX logging", () => {
    test("logs can be retrieved", async () => {
        let logs = [];

        await navigateTo("http://localhost:3000/auto-false.html");
        logs = await page.evaluate("LUX.getDebug()");

        expect(logs[0][1]).toEqual(LogEvent.EvaluationStart);
        expect(logs[logs.length - 1][1]).toEqual(LogEvent.EvaluationEnd);

        await page.evaluate("LUX.send()");
        logs = await page.evaluate("LUX.getDebug()");

        expect(logs[logs.length - 1][1]).toEqual(LogEvent.MainBeaconSent);
    });
});
