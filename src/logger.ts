import now from "./now";

export const LogEvent: Record<string, number> = {
  // Internal events
  EvaluationStart: 1,
  EvaluationEnd: 2,
  InitCalled: 3,
  MarkCalled: 4,
  MeasureCalled: 5,
  AddDataCalled: 6,
  SendCalled: 7,
  ForceSampleCalled: 8,
  DataCollectionStart: 9,
  UnloadHandlerTriggered: 10,
  OnloadHandlerTriggered: 11,
  MarkLoadTimeCalled: 12,
  SendCancelledPageHidden: 13,

  // Data collection events
  SessionIsSampled: 21,
  SessionIsNotSampled: 22,
  MainBeaconSent: 23,
  UserTimingBeaconSent: 24,
  InteractionBeaconSent: 25,
  CustomDataBeaconSent: 26,

  // Metric information
  NavigationStart: 41,
  PerformanceEntryReceived: 42,
  PerformanceEntryProcessed: 43,

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

  // POST beacon events
  PostBeaconInitialised: 80,
  PostBeaconSendCalled: 81,
  PostBeaconTimeoutReached: 82,
  PostBeaconSent: 83,
  PostBeaconAlreadySent: 84,
  PostBeaconCancelled: 85,
};

export type LogEventRecord = [number, number, ...unknown[]];

export default class Logger {
  events: LogEventRecord[] = [];

  logEvent(event: number, args: unknown[] = []) {
    this.events.push([now(), event, args]);
  }

  getEvents() {
    return this.events;
  }
}
