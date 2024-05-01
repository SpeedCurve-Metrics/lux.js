import { MetricData } from "../beacon";
import { floor, max } from "../math";

let sessionValue = 0;
let sessionEntries: LayoutShift[] = [];
let largestEntry: LayoutShift | undefined;
let maximumSessionValue = 0;

export function processEntry(entry: LayoutShift): void {
  if (!entry.hadRecentInput) {
    const firstEntry = sessionEntries[0];
    const latestEntry = sessionEntries[sessionEntries.length - 1];

    if (
      sessionEntries.length &&
      (entry.startTime - latestEntry.startTime >= 1000 ||
        entry.startTime - firstEntry.startTime >= 5000)
    ) {
      sessionValue = entry.value;
      sessionEntries = [entry];
      largestEntry = entry;
    } else {
      sessionValue += entry.value;
      sessionEntries.push(entry);

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

export function getData(): MetricData["cls"] {
  return {
    // CLS is stored as REAL (FLOAT4) which represents a maximum of 6 significant digits
    value: maximumSessionValue,
    largestEntry: largestEntry
      ? {
          value: largestEntry.value,
          startTime: floor(largestEntry.startTime),
        }
      : null,
  };
}
