export const LogEvent = {
  // Internal events
  EvaluationStart: 1,
  EvaluationEnd: 2,
  InitCalled: 3,
  MarkCalled: 4,
  MeasureCalled: 5,
  AddDataCalled: 6,
  SendCalled: 7,

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

  // Browser support messages
  NavTimingNotSupported: 71,
  PaintTimingNotSupported: 72,
};

type LogEventRecord = [number, number, ...unknown[]];

export default class Logger {
  events: LogEventRecord[] = [];

  logEvent(event: number, ...args: unknown[]) {
    this.events.push([Number(new Date()), event, args]);
  }

  getEvents() {
    return this.events;
  }
}
