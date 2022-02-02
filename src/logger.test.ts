import Logger, { LogEvent } from "./logger";

describe("Logger", () => {
  test("every event is unique", () => {
    const eventValues = Object.values(LogEvent);
    const uniqueValues = new Set(eventValues);

    expect(uniqueValues.size).toEqual(eventValues.length);
  });

  test("events can be logged and retrieved", () => {
    const logger = new Logger();
    const timestamp = new Date();

    logger.logEvent(LogEvent.EvaluationStart);
    logger.logEvent(LogEvent.AddDataCalled, ["varName", "value"]);
    logger.logEvent(LogEvent.EvaluationEnd);

    const events = logger.getEvents();

    expect(Number(events[0][0])).toBeGreaterThanOrEqual(Number(timestamp));
    expect(events[0][1]).toEqual(LogEvent.EvaluationStart);
    expect(events[1][1]).toEqual(LogEvent.AddDataCalled);
    expect(events[1][2]).toEqual(["varName", "value"]);
    expect(events[2][1]).toEqual(LogEvent.EvaluationEnd);
  });
});
