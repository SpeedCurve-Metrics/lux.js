import { LogEvent, LogEventRecord } from "../../src/logger";
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

function renderOutput(output: Element) {
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
      // Always show the navigation start event first
      navigationStart = (event[2] as [number])[0];
      break;
    }
  }

  const filters = getFilters(filterInputs);

  inputEvents.forEach((event: LogEventRecord) => {
    const timestamp = Number(new Date(event[0])) - navigationStart;
    const message = getMessageForEvent(event, filters);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const args = event[2] as any[];

    if (message) {
      if (isBeaconEvent(event[1])) {
        const item = li(`${new Intl.NumberFormat().format(timestamp)} ms: ${message}`);
        item.classList.add("tooltip-container");

        const beaconUrl = new URL(args[0]);
        const tooltip = document.createElement("span");
        tooltip.className = "tooltip";
        tooltip.innerHTML = `
          <b>Page label:</b> ${beaconUrl.searchParams.get("l")}<br>
          <b>Hostname:</b> ${beaconUrl.searchParams.get("HN")}<br>
          <b>Path:</b> ${beaconUrl.searchParams.get("PN")}<br>
          <b>lux.js version:</b> ${beaconUrl.searchParams.get("v")}<br>
        `;

        item.appendChild(tooltip);
        output.appendChild(item);
      } else if (event[1] === LogEvent.EvaluationStart && typeof args[1] === "object") {
        // Support for EvaluationStart event containing LUX config (since v313)
        const item = li(
          `${new Intl.NumberFormat().format(
            timestamp,
          )} ms: ${message} Hover to view configuration.`,
        );
        item.classList.add("tooltip-container");

        const tooltip = document.createElement("span");
        tooltip.className = "tooltip";
        tooltip.innerHTML = `<pre>${JSON.stringify(args[1], null, 4)}</pre>`;

        item.appendChild(tooltip);
        output.appendChild(item);
      } else {
        output.appendChild(li(`${new Intl.NumberFormat().format(timestamp)} ms: ${message}`));
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
