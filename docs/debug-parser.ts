import { LogEvent, LogEventRecord } from "../src/logger";

const input = document.querySelector("#input") as HTMLTextAreaElement;
const eventCounter = document.querySelector("#event-counter") as HTMLSpanElement;
const output = document.querySelector("#output");
const parseBtn = document.querySelector("#parse");

if (!input || !output || !parseBtn) {
  throw new Error("Cannot start debug parser.");
}

parseBtn.addEventListener("click", () => {
  output.innerHTML = "";

  let inputEvents = [];

  try {
    inputEvents = JSON.parse(input.value);
  } catch (err) {
    output.appendChild(li(`Could not parse input: ${err}`, "red"));
  }

  eventCounter.innerText = `(${inputEvents.length} events)`;

  let navigationStart = Number(new Date(inputEvents[0][0]));

  for (const event of inputEvents) {
    if (event[1] === LogEvent.NavigationStart) {
      navigationStart = (event[2] as [number])[0];
      break;
    }
  }

  inputEvents.forEach((event: LogEventRecord) => {
    const timestamp = Number(new Date(event[0])) - navigationStart;
    const message = getMessageForEvent(event);

    if (message) {
      output.appendChild(li(`${new Intl.NumberFormat().format(timestamp)} ms: ${message}`));
    }
  });

  const startTime = new Date(navigationStart);

  output.prepend(
    li(
      `0 ms: Navigation started at ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}`
    )
  );
});

function argsAsString(args: any[]): string {
  return args.map((v) => JSON.stringify(v)).join(", ");
}

function getMessageForEvent(event: LogEventRecord): string {
  const eventName = Object.keys(LogEvent).find((k) => LogEvent[k] === event[1]);
  const args = event[2] as any[];

  // Fallback message is the raw event name and any arguments
  let message = eventName || "Unknown Event";

  if (args.length) {
    message += ` (${argsAsString(args)})`;
  }

  switch (event[1]) {
    case LogEvent.EvaluationStart:
      return `lux.js v${args[0]} is initialising.`;

    case LogEvent.EvaluationEnd:
      return "lux.js has finished initialising.";

    case LogEvent.InitCalled:
      return "LUX.init()";

    case LogEvent.MarkCalled:
      return `LUX.mark(${argsAsString(args)})`;

    case LogEvent.MeasureCalled:
      return `LUX.measure(${argsAsString(args)})`;

    case LogEvent.AddDataCalled:
      return `LUX.addData(${argsAsString(args)})`;

    case LogEvent.SendCalled:
      return "LUX.send()";

    case LogEvent.ForceSampleCalled:
      return "LUX.forceSample()";

    case LogEvent.DataCollectionStart:
      return "Beginning data collection. New events after this point may not be recorded for this page.";

    case LogEvent.UnloadHandlerTriggered:
      return "Unload handler was triggered.";

    case LogEvent.OnloadHandlerTriggered:
      message = `Onload handler was triggered after ${args[0]} ms.`;

      if (args[1] > 0) {
        message += `Minimum measure time was ${args[1]}`;
      }

      return message;

    case LogEvent.SessionIsSampled:
      return `Sample rate is ${args[0]}%. This session is being sampled.`;

    case LogEvent.SessionIsNotSampled:
      return `Sample rate is ${args[0]}%. This session is not being sampled.`;

    case LogEvent.MainBeaconSent:
      return `Main beacon sent: ${args[0]}`;

    case LogEvent.UserTimingBeaconSent:
      return `Supplementary user timing beacon sent: ${args[0]}`;

    case LogEvent.InteractionBeaconSent:
      return `Supplementary user interaction beacon sent: ${args[0]}`;

    case LogEvent.CustomDataBeaconSent:
      return `Supplementary custom data beacon sent: ${args[0]}`;

    case LogEvent.NavigationStart:
      return "";

    case LogEvent.PerformanceEntryReceived:
      if (args[0].entryType === "layout-shift") {
        return `Received layout shift with value of ${args[0].value.toFixed(3)}`;
      } else if (args[0].entryType === "longtask") {
        return `Received long task with duration of ${args[0].duration} ms`;
      } else if (args[0].entryType === "largest-contentful-paint") {
        return `Received LCP entry at ${args[0].startTime} ms`;
      } else if (args[0].entryType === "element") {
        return `Received element timing entry for ${args[0].identifier} at ${args[0].startTime} ms`;
      }

      return `Received ${args[0].entryType} entry`;

    case LogEvent.PerformanceEntryProcessed:
      if (args[0].entryType === "largest-contentful-paint") {
        return `Picked LCP from entry at ${args[0].startTime} ms`;
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

function li(textContent: string, className?: string): HTMLLIElement {
  const el = document.createElement("li");

  el.textContent = textContent;
  el.className = className || "";

  return el;
}
