import { LogEvent, LogEventRecord } from "../../src/logger";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function argsAsString(args: any[]): string {
  return args.map((v) => JSON.stringify(v)).join(", ");
}

export function isBeaconEvent(event: LogEvent) {
  return [
    LogEvent.MainBeaconSent,
    LogEvent.CustomDataBeaconSent,
    LogEvent.InteractionBeaconSent,
    LogEvent.UserTimingBeaconSent,
  ].includes(event);
}

export function getMessageForEvent(event: LogEventRecord, filters: string[]): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const args = event[2] as any[];

  // Fallback message is the raw event name and any arguments
  let message = getEventName(event[1]);

  if (args.length) {
    message += ` (${argsAsString(args)})`;
  }

  switch (event[1]) {
    case 0:
      return "The lux.js script was not loaded on this page.";

    case LogEvent.EvaluationStart:
      return `lux.js v${args[0]} is initialising.`;

    case LogEvent.EvaluationEnd:
      return "lux.js has finished initialising.";

    case LogEvent.InitCalled:
      return "LUX.init()";

    case LogEvent.MarkLoadTimeCalled:
      return `LUX.markLoadTime(${argsAsString(args)})`;

    case LogEvent.MarkCalled:
      if (filters.includes("userTiming")) {
        return `LUX.mark(${argsAsString(args)})`;
      }

      return "";

    case LogEvent.MeasureCalled:
      if (filters.includes("userTiming")) {
        return `LUX.measure(${argsAsString(args)})`;
      }

      return "";

    case LogEvent.AddDataCalled:
      if (filters.includes("addData")) {
        return `LUX.addData(${argsAsString(args)})`;
      }

      return "";

    case LogEvent.TrackingParamAdded:
      return `Tracking parameter ${args[0]}=${args[1]} picked up automatically`;

    case LogEvent.SendCalled:
      return "LUX.send()";

    case LogEvent.SendCancelledPageHidden:
      return "This beacon was not sent because the page visibility was hidden.";

    case LogEvent.ForceSampleCalled:
      return "LUX.forceSample()";

    case LogEvent.DataCollectionStart:
      return "Preparing to send main beacon. Metrics received after this point may be ignored.";

    case LogEvent.UnloadHandlerTriggered:
      return "Unload handler was triggered.";

    case LogEvent.OnloadHandlerTriggered:
      message = `Onload handler was triggered after ${args[0]} ms.`;

      if (args[1] > 0) {
        message += ` Minimum measure time was ${args[1]}`;
      }

      return message;

    case LogEvent.SessionIsSampled:
      return `Sample rate is ${args[0]}%. This session is being sampled.`;

    case LogEvent.SessionIsNotSampled:
      return `Sample rate is ${args[0]}%. This session is not being sampled.`;

    case LogEvent.MainBeaconSent:
      message = "Main beacon sent";

      if (filters.includes("beaconUrl")) {
        message += `: ${args[0]}`;
      }

      return message;

    case LogEvent.UserTimingBeaconSent:
      message = "Supplementary user timing beacon sent";

      if (filters.includes("beaconUrl")) {
        message += `: ${args[0]}`;
      }

      return message;

    case LogEvent.InteractionBeaconSent:
      message = "Supplementary user interaction beacon sent";

      if (filters.includes("beaconUrl")) {
        message += `: ${args[0]}`;
      }

      return message;

    case LogEvent.CustomDataBeaconSent:
      message = "Supplementary custom data beacon sent";

      if (filters.includes("beaconUrl")) {
        message += `: ${args[0]}`;
      }

      return message;

    case LogEvent.PostBeaconInitialised:
      return "POST beacon initialised.";

    case LogEvent.PostBeaconSendCalled:
      return "POST beacon send() called.";

    case LogEvent.PostBeaconTimeoutReached:
      return "POST beacon maximum measure timeout reached.";

    case LogEvent.PostBeaconSent:
      if (filters.includes("beaconUrl")) {
        return `POST beacon sent: ${args[0]}`;
      }

      return "POST beacon sent.";

    case LogEvent.PostBeaconSendFailed:
      if (filters.includes("beaconUrl")) {
        return `POST beacon send failed: ${args[0]}`;
      }

      return "POST beacon send failed.";

    case LogEvent.PostBeaconAlreadySent:
      return "POST beacon cancelled (already sent).";

    case LogEvent.PostBeaconCancelled:
      return "POST beacon cancelled.";

    case LogEvent.PostBeaconStopRecording:
      return "POST beacon is no longer recording metrics. Metrics received after this point may be ignored.";

    case LogEvent.PostBeaconMetricRejected:
      return `POST beacon metric rejected: ${args[0]}`;

    case LogEvent.PostBeaconCSPViolation:
      return "POST beacon cancelled due to CSP violation.";

    case LogEvent.PostBeaconCollector:
      return `POST beacon metric collector: ${args[0]} (has data: ${args[1]})`;

    case LogEvent.NavigationStart:
      return "";

    case LogEvent.PerformanceEntryReceived:
      if (args[0].entryType === "layout-shift") {
        return `Received layout shift at ${args[0].startTime.toFixed()} ms with value of ${args[0].value.toFixed(
          3,
        )}`;
      } else if (args[0].entryType === "longtask") {
        return `Received long task with duration of ${args[0].duration} ms`;
      } else if (args[0].entryType === "event") {
        if (args[0].interactionId === 0) {
          return `Ignored INP entry with no interaction ID`;
        } else {
          return `Received INP entry with duration of ${args[0].duration} ms (ID: ${args[0].interactionId})`;
        }
      } else if (args[0].entryType === "first-input") {
        return `Received FID entry with duration of ${args[0].duration} ms`;
      } else if (args[0].entryType === "largest-contentful-paint") {
        return `Received LCP entry at ${args[0].startTime.toFixed()} ms`;
      } else if (args[0].entryType === "element") {
        return `Received element timing entry for ${
          args[0].identifier
        } at ${args[0].startTime.toFixed()} ms`;
      }

      message = `Received ${args[0].entryType} entry`;

      if (args[0].startTime) {
        message += ` at ${args[0].startTime.toFixed()} ms`;
      }

      return message;

    case LogEvent.PerformanceEntryProcessed:
      if (args[0].entryType === "largest-contentful-paint") {
        return `Picked LCP from entry at ${args[0].startTime.toFixed()} ms`;
      }

      return "";

    case LogEvent.PerformanceObserverError:
      return `Error while initialising PerformanceObserver: ${args[0]}`;

    case LogEvent.InputEventPermissionError:
      return "Error reading input event. Cannot calculate FID for this page.";

    case LogEvent.InnerHtmlAccessError:
      return "Cannot read the innerHTML property of an element. Cannot calculate inline style or script sizes for this page.";

    case LogEvent.EventTargetAccessError:
      return "Error reading input event. Cannot calculate user interaction times for this page.";

    case LogEvent.CookieReadError:
      return "Error reading session cookie. This page will not be linked to a user session.";

    case LogEvent.CookieSetError:
      return "Error setting session cookie. This page will not be linked to a user session.";

    case LogEvent.PageLabelEvaluationError:
      return `Error while evaluating '${args[0]}' for the page label: ${args[1]}`;

    case LogEvent.NavTimingNotSupported:
      return "The Navigation Timing API is not supported. Performance metrics for this page will be limited.";

    case LogEvent.PaintTimingNotSupported:
      return "Start render time could not be determined.";
  }

  return message;
}

function getEventName(event: LogEvent) {
  switch (event) {
    case LogEvent.EvaluationStart:
      return "EvaluationStart";
    case LogEvent.EvaluationEnd:
      return "EvaluationEnd";
    case LogEvent.InitCalled:
      return "InitCalled";
    case LogEvent.MarkCalled:
      return "MarkCalled";
    case LogEvent.MeasureCalled:
      return "MeasureCalled";
    case LogEvent.AddDataCalled:
      return "AddDataCalled";
    case LogEvent.SendCalled:
      return "SendCalled";
    case LogEvent.ForceSampleCalled:
      return "ForceSampleCalled";
    case LogEvent.DataCollectionStart:
      return "DataCollectionStart";
    case LogEvent.UnloadHandlerTriggered:
      return "UnloadHandlerTriggered";
    case LogEvent.OnloadHandlerTriggered:
      return "OnloadHandlerTriggered";
    case LogEvent.MarkLoadTimeCalled:
      return "MarkLoadTimeCalled";
    case LogEvent.SendCancelledPageHidden:
      return "SendCancelledPageHidden";
    case LogEvent.SessionIsSampled:
      return "SessionIsSampled";
    case LogEvent.SessionIsNotSampled:
      return "SessionIsNotSampled";
    case LogEvent.MainBeaconSent:
      return "MainBeaconSent";
    case LogEvent.UserTimingBeaconSent:
      return "UserTimingBeaconSent";
    case LogEvent.InteractionBeaconSent:
      return "InteractionBeaconSent";
    case LogEvent.CustomDataBeaconSent:
      return "CustomDataBeaconSent";
    case LogEvent.NavigationStart:
      return "NavigationStart";
    case LogEvent.PerformanceEntryReceived:
      return "PerformanceEntryReceived";
    case LogEvent.PerformanceEntryProcessed:
      return "PerformanceEntryProcessed";
    case LogEvent.TrackingParamAdded:
      return "TrackingParamAdded";
    case LogEvent.PerformanceObserverError:
      return "PerformanceObserverError";
    case LogEvent.InputEventPermissionError:
      return "InputEventPermissionError";
    case LogEvent.InnerHtmlAccessError:
      return "InnerHtmlAccessError";
    case LogEvent.EventTargetAccessError:
      return "EventTargetAccessError";
    case LogEvent.CookieReadError:
      return "CookieReadError";
    case LogEvent.CookieSetError:
      return "CookieSetError";
    case LogEvent.PageLabelEvaluationError:
      return "PageLabelEvaluationError";
    case LogEvent.NavTimingNotSupported:
      return "NavTimingNotSupported";
    case LogEvent.PaintTimingNotSupported:
      return "PaintTimingNotSupported";
    case LogEvent.PostBeaconInitialised:
      return "PostBeaconInitialised";
    case LogEvent.PostBeaconSendCalled:
      return "PostBeaconSendCalled";
    case LogEvent.PostBeaconTimeoutReached:
      return "PostBeaconTimeoutReached";
    case LogEvent.PostBeaconSent:
      return "PostBeaconSent";
    case LogEvent.PostBeaconAlreadySent:
      return "PostBeaconAlreadySent";
    case LogEvent.PostBeaconCancelled:
      return "PostBeaconCancelled";
    case LogEvent.PostBeaconStopRecording:
      return "PostBeaconStopRecording";
    case LogEvent.PostBeaconMetricRejected:
      return "PostBeaconMetricRejected";
    case LogEvent.PostBeaconSendFailed:
      return "PostBeaconSendFailed";
    case LogEvent.PostBeaconCSPViolation:
      return "PostBeaconCSPViolation";
    case LogEvent.PostBeaconCollector:
      return "PostBeaconCollector";
  }
}
