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
}

// A list of the slowest interactions
let slowestEntries: Interaction[] = [];

// A map of the slowest interactions by ID
let slowestEntryMap: Record<number, Interaction> = {};

// The total number of interactions recorded on the page
let interactionCount = 0;

export function reset(): void {
  interactionCount = 0;
  slowestEntries = [];
  slowestEntryMap = {};
}

export function addEntry(entry: PerformanceEventTiming): void {
  interactionCount++;

  const { duration, interactionId } = entry;
  const existingEntry = slowestEntryMap[interactionId!];

  if (existingEntry) {
    existingEntry.duration = Math.max(duration, existingEntry.duration);
  } else {
    slowestEntryMap[interactionId!] = { duration, interactionId };
    slowestEntries.push(slowestEntryMap[interactionId!]);
  }

  // Only store the longest <MAX_INTERACTIONS> interactions
  slowestEntries.sort((a, b) => b.duration - a.duration);
  slowestEntries.splice(MAX_INTERACTIONS).forEach((entry) => {
    delete slowestEntryMap[entry.interactionId!];
  });
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

  return interactionCount;
}
