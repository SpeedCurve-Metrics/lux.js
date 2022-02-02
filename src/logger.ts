export const LogEvent = {
  // Internal events
  EvaluationStart: 1,
  EvaluationEnd: 2,
  InitCalled: 3,
  MarkCalled: 4,
  MeasureCalled: 5,
  AddDataCalled: 6,
  SendCalled: 7,
  ForceSampleCalled: 8,

  // Data collection events
  SessionIsSampled: 21,
  SessionIsNotSampled: 22,
  MainBeaconSent: 23,
  UserTimingBeaconSent: 24,
  InteractionBeaconSent: 25,
  CustomDataBeaconSent: 26,

  // Errors
  PerformanceObserverError: 51,
  InputEventPermissionError: 52,
  InnerHtmlAccessError: 53,
  EventTargetAccessError: 54,
  CookieReadError: 55,
  CookieSetError: 56,
  PageLabelEvaluationError: 57,

  // Browser support messages
  NavTimingNotSupported: 71,
  PaintTimingNotSupported: 72,
};

export type LogEventRecord = [Date, number, ...unknown[]];

export default class Logger {
  events: LogEventRecord[] = [];

  logEvent(event: number, args: unknown[] = []) {
    this.events.push([new Date(), event, args]);
  }

  getEvents() {
    return this.events;
  }
}
