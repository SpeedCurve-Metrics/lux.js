import { CLSAttribution, BeaconMetricData } from "../beacon";
import { getNodeSelector } from "../dom";
import { max } from "../math";
import { processTimeMetric } from "../timing";

let sessionValue = 0;
let sessionEntries: LayoutShift[] = [];
let sessionAttributions: CLSAttribution[] = [];
let largestEntry: LayoutShift | undefined;
let maximumSessionValue = 0;

export function processEntry(entry: LayoutShift): void {
  if (!entry.hadRecentInput) {
    const firstEntry = sessionEntries[0];
    const latestEntry = sessionEntries[sessionEntries.length - 1];
    const sources = entry.sources
      .filter((source) => source.node)
      .map((source) => ({
        value: entry.value,
        startTime: processTimeMetric(entry.startTime),
        elementSelector: getNodeSelector(source.node!),
        elementType: source.node!.nodeName,
      }));

    if (
      sessionEntries.length &&
      (entry.startTime - latestEntry.startTime >= 1000 ||
        entry.startTime - firstEntry.startTime >= 5000)
    ) {
      sessionValue = entry.value;
      sessionEntries = [entry];
      sessionAttributions = sources;
      largestEntry = entry;
    } else {
      sessionValue += entry.value;
      sessionEntries.push(entry);
      sessionAttributions = sessionAttributions.concat(sources);

      if (!largestEntry || entry.value > largestEntry.value) {
        largestEntry = entry;
      }
    }

    maximumSessionValue = max(maximumSessionValue, sessionValue);
  }
}

export function reset(): void {
  sessionValue = 0;
  sessionEntries = [];
  maximumSessionValue = 0;
  largestEntry = undefined;
}

export function getData(): BeaconMetricData["cls"] {
  return {
    value: maximumSessionValue,
    startTime: sessionEntries[0] ? processTimeMetric(sessionEntries[0].startTime) : null,
    largestEntry: largestEntry
      ? {
          value: largestEntry.value,
          startTime: processTimeMetric(largestEntry.startTime),
        }
      : null,
    sources: sessionAttributions.length ? sessionAttributions : null,
  };
}
