import { CLSAttribution, BeaconMetricData, BeaconMetricKey } from "../beacon";
import { UserConfig } from "../config";
import * as Const from "../constants";
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
      ? entry.sources
          .filter((source) => source.node)
          .map((source) => ({
            value: entry[Const.value],
            startTime: processTimeMetric(entry[Const.startTime]),
            elementSelector: getNodeSelector(source.node!),
            elementType: source.node!.nodeName,
          }))
      : [];

    if (
      sessionEntries.length &&
      (entry[Const.startTime] - latestEntry[Const.startTime] >= 1000 ||
        entry[Const.startTime] - firstEntry[Const.startTime] >= 5000)
    ) {
      sessionValue = entry[Const.value];
      sessionEntries = [entry];
      sessionAttributions = sources;
      largestEntry = entry;
    } else {
      sessionValue += entry[Const.value];
      sessionEntries.push(entry);
      sessionAttributions = sessionAttributions.concat(sources);

      if (!largestEntry || entry[Const.value] > largestEntry[Const.value]) {
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
    startTime: sessionEntries[0] ? processTimeMetric(sessionEntries[0][Const.startTime]) : null,
    largestEntry: largestEntry
      ? {
          value: largestEntry[Const.value],
          startTime: processTimeMetric(largestEntry[Const.startTime]),
        }
      : null,
    sources: sessionAttributions.length
      ? sessionAttributions.slice(0, config.maxAttributionEntries)
      : null,
  };
}
