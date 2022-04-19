import { LogEvent, LogEventRecord } from "../../src/logger";
import { getMessageForEvent } from "./events";
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
      navigationStart = (event[2] as [number])[0];
      break;
    }
  }

  const filters = getFilters(filterInputs);

  inputEvents.forEach((event: LogEventRecord) => {
    const timestamp = Number(new Date(event[0])) - navigationStart;
    const message = getMessageForEvent(event, filters);

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
}

function li(textContent: string, className?: string): HTMLLIElement {
  const el = document.createElement("li");

  el.textContent = textContent;
  el.className = className || "";

  return el;
}
