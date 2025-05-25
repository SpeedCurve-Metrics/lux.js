import { describe, expect, test } from "@jest/globals";
import Logger, { LogEvent } from "../../src/logger";

describe("Logger", () => {
  test("events can be logged and retrieved", () => {
    const logger = new Logger();
    const timestamp = Date.now();

    logger.logEvent(LogEvent.EvaluationStart);
    logger.logEvent(LogEvent.AddDataCalled, ["varName", "value"]);
    logger.logEvent(LogEvent.EvaluationEnd);

    const events = logger.getEvents();

    expect(Number(events[0][0])).toBeGreaterThanOrEqual(timestamp);
    expect(events[0][1]).toEqual(LogEvent.EvaluationStart);
    expect(events[1][1]).toEqual(LogEvent.AddDataCalled);
    expect(events[1][2]).toEqual(["varName", "value"]);
    expect(events[2][1]).toEqual(LogEvent.EvaluationEnd);
  });
});
