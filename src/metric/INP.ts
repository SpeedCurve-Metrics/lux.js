import { max } from "../math";
import { performance } from "../performance";

/**
 * This implementation is based on the web-vitals implementation, however it is stripped back to the
 * bare minimum required to measure just the INP value and does not store the actual event entries.
 */

// The maximum number of interactions to store
const MAX_INTERACTIONS = 10;

interface Interaction {
  interactionId: number | undefined;
  duration: number;
  startTime: number;
}

// A list of the slowest interactions
let slowestEntries: Interaction[] = [];

// A map of the slowest interactions by ID
let slowestEntriesMap: Record<number, Interaction> = {};

// The total number of interactions recorded on the page
let interactionCountEstimate = 0;

export function reset(): void {
  interactionCountEstimate = 0;
  slowestEntries = [];
  slowestEntriesMap = {};
}

export function addEntry(entry: PerformanceEventTiming): void {
  if (entry.interactionId || (entry.entryType === "first-input" && !entryExists(entry))) {
    const { duration, startTime, interactionId } = entry;
    const existingEntry = slowestEntriesMap[interactionId!];

    if (existingEntry) {
      existingEntry.duration = max(duration, existingEntry.duration);
    } else {
      interactionCountEstimate++;
      slowestEntriesMap[interactionId!] = { duration, interactionId, startTime };
      slowestEntries.push(slowestEntriesMap[interactionId!]);
    }

    // Only store the longest <MAX_INTERACTIONS> interactions
    slowestEntries.sort((a, b) => b.duration - a.duration);
    slowestEntries.splice(MAX_INTERACTIONS).forEach((entry) => {
      delete slowestEntriesMap[entry.interactionId!];
    });
  }
}

function entryExists(e1: PerformanceEntry): boolean {
  return slowestEntries.some((e2) => e1.startTime === e2.startTime && e1.duration === e2.duration);
}

/**
 * Returns an estimated high percentile INP value based on the total number of interactions on the
 * current page.
 */
export function getHighPercentileINP(): number | undefined {
  const index = Math.min(slowestEntries.length - 1, Math.floor(getInteractionCount() / 50));

  return slowestEntries[index]?.duration;
}

function getInteractionCount(): number {
  if ("interactionCount" in performance) {
    return performance.interactionCount;
  }

  return interactionCountEstimate;
}
