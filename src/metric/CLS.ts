import { CLSAttribution, BeaconMetricData, BeaconMetricKey } from "../beacon";
import { UserConfig } from "../config";
import { getNodeSelector } from "../dom";
import { max } from "../math";
import * as PROPS from "../minification";
import { processTimeMetric } from "../timing";

let sessionValue = 0;
let sessionEntries: LayoutShift[] = [];
let sessionAttributions: CLSAttribution[] = [];
let largestEntry: LayoutShift | undefined;
let maximumSessionValue = 0;

export function processEntry(entry: LayoutShift): void {
  if (!entry.hadRecentInput) {
    const firstEntry = sessionEntries[0];
    const latestEntry = sessionEntries[sessionEntries[PROPS._length] - 1];
    const sources = entry.sources
      ? entry.sources
          .filter((source) => source.node)
          .map((source) => ({
            value: entry.value,
            startTime: processTimeMetric(entry[PROPS._startTime]),
            elementSelector: getNodeSelector(source.node!),
            elementType: source.node!.nodeName,
          }))
      : [];

    if (
      sessionEntries[PROPS._length] &&
      (entry[PROPS._startTime] - latestEntry[PROPS._startTime] >= 1000 ||
        entry[PROPS._startTime] - firstEntry[PROPS._startTime] >= 5000)
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

export function getData(config: UserConfig): BeaconMetricData[BeaconMetricKey.CLS] | undefined {
  if (!("LayoutShift" in self)) {
    return undefined;
  }

  return {
    value: maximumSessionValue,
    startTime: sessionEntries[0] ? processTimeMetric(sessionEntries[0][PROPS._startTime]) : null,
    largestEntry: largestEntry
      ? {
          value: largestEntry.value,
          startTime: processTimeMetric(largestEntry[PROPS._startTime]),
        }
      : null,
    sources: sessionAttributions[PROPS._length]
      ? sessionAttributions.slice(0, config.maxAttributionEntries)
      : null,
  };
}
