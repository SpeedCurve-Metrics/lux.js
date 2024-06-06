import { LogEvent, LogEventRecord } from "../../src/logger";
import { getNavTiming } from "../../tests/helpers/lux";
import { getMessageForEvent, isBeaconEvent } from "./events";
import { getFilters } from "./filters";

const input = document.querySelector("#input") as HTMLTextAreaElement;
const eventCounter = document.querySelector("#event-counter") as HTMLSpanElement;
const output = document.querySelector("#output");
const parseBtn = document.querySelector("#parse");
const filterInputs = document.querySelectorAll(".event-filter") as NodeListOf<HTMLInputElement>;

if (!input || !output || !parseBtn) {
  throw new Error("Cannot start debug parser.");
}

parseBtn.addEventListener("click", () => renderOutput(output));
filterInputs.forEach((input) => {
  input.addEventListener("change", () => renderOutput(output));
});

if (input.value) {
  // Initial render if there is already input
  renderOutput(output);
}

function renderOutput(output: Element) {
  output.innerHTML = "";

  let inputEvents: LogEventRecord[] = [];

  try {
    inputEvents = JSON.parse(input.value);
  } catch (err) {
    output.appendChild(li(`Could not parse input: ${err}`, "red"));
  }

  eventCounter.innerText = `(${inputEvents.length} events)`;

  let navigationStart = Number(new Date(inputEvents[0][0]));

  for (const event of inputEvents) {
    if (event[1] === LogEvent.NavigationStart) {
      // Always show the navigation start event first
      navigationStart = (event[2] as [number])[0];
      break;
    }
  }

  let lastInit = navigationStart;
  let dataCollectionFinished = false;
  const filters = getFilters(filterInputs);

  inputEvents.forEach((event, eventIndex) => {
    const timestamp = Number(new Date(event[0])) - navigationStart;
    const message = getMessageForEvent(event, filters);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = event[2] as any[];

    if (message) {
      if (isBeaconEvent(event[1])) {
        const item = li(`${new Intl.NumberFormat().format(timestamp)} ms: ${message}`);
        item.classList.add("tooltip-container");

        const beaconUrl = new URL(args[0]);
        const NT = getNavTiming(beaconUrl);
        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.innerHTML = `
          <div class="tooltip-inner">
            <b>Page label:</b> ${beaconUrl.searchParams.get("l")}<br>
            <b>Hostname:</b> ${beaconUrl.searchParams.get("HN")}<br>
            <b>Path:</b> ${beaconUrl.searchParams.get("PN")}<br>
            <b>lux.js version:</b> ${beaconUrl.searchParams.get("v")}<br>
            <hr>
            <b>LCP:</b> ${NT.largestContentfulPaint}<br>
            <b>CLS:</b> ${beaconUrl.searchParams.get("DCLS")}<br>
            <b>INP:</b> ${beaconUrl.searchParams.get("INP")}<br>
            <b>FID:</b> ${beaconUrl.searchParams.get("FID")}<br>
          </div>
        `;

        item.appendChild(tooltip);
        output.appendChild(item);
      } else if (event[1] === LogEvent.EvaluationStart) {
        // Support for EvaluationStart event containing LUX config (since v313)
        const item = li(
          `${new Intl.NumberFormat().format(
            timestamp,
          )} ms: ${message} Hover to view configuration.`,
        );
        item.classList.add("tooltip-container");

        let config = args[1];
        try {
          config = JSON.parse(config);
        } catch (e) {
          // Ignore
        }

        const tooltip = document.createElement("div");
        tooltip.className = "tooltip";
        tooltip.innerHTML = `
          <div class="tooltip-inner">
            <pre>${JSON.stringify(config, null, 4)}</pre>
          </div>
        `;

        item.appendChild(tooltip);
        output.appendChild(item);
      } else {
        output.appendChild(li(`${new Intl.NumberFormat().format(timestamp)} ms: ${message}`));
      }

      // Track when data collection has finished
      if (event[1] === LogEvent.DataCollectionStart) {
        dataCollectionFinished = true;
      }

      // Track when a new beacon is initialised
      if (event[1] === LogEvent.InitCalled) {
        lastInit = event[0];
        dataCollectionFinished = false;
      }

      // Warn when data was gathered for less than 1 second
      if (event[1] === LogEvent.SendCalled) {
        const sendTime = event[0];
        const measureTime = sendTime - lastInit;

        if (measureTime < 1000) {
          output.appendChild(
            li(
              `${new Intl.NumberFormat().format(
                timestamp,
              )} ms: ⚠️ Data was gathered for less than 1 second. Consider increasing the value of LUX.minMeasureTime.`,
            ),
          );
        }
      }

      // Warn when performance entries occur after data collection has finished
      if (dataCollectionFinished && event[1] === LogEvent.PerformanceEntryReceived) {
        const nextEvent = inputEvents[eventIndex + 1];

        // Only show the warning once for multiple performance entries
        if (nextEvent[1] !== LogEvent.PerformanceEntryReceived) {
          output.appendChild(
            li(
              `${new Intl.NumberFormat().format(
                timestamp,
              )} ms: ⚠️ Performance entries were received after the beacon was sent.`,
            ),
          );
        }
      }
    }
  });

  const startTime = new Date(navigationStart);

  output.prepend(
    li(
      `0 ms: Navigation started at ${startTime.toLocaleDateString()} ${startTime.toLocaleTimeString()}`,
    ),
  );
}

function li(textContent: string, className?: string): HTMLLIElement {
  const el = document.createElement("li");

  el.textContent = textContent;
  el.className = className || "";

  return el;
}
