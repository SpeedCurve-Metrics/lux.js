import { max } from "../math";

let sessionValue = 0;
let sessionEntries: LayoutShift[] = [];
let maximumSessionValue = 0;

export function addEntry(entry: LayoutShift): void {
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
    } else {
      sessionValue += entry.value;
      sessionEntries.push(entry);
    }

    maximumSessionValue = max(maximumSessionValue, sessionValue);
  }
}

export function reset(): void {
  sessionValue = 0;
  sessionEntries = [];
  maximumSessionValue = 0;
}

export function getCLS(): number {
  return maximumSessionValue;
}
