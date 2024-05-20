import { getNodeSelector } from "../dom";
import { performance } from "../performance";

/**
 * This implementation is based on the web-vitals implementation, however it is stripped back to the
 * bare minimum required to measure just the INP value and does not store the actual event entries.
 */

// The maximum number of interactions to store
const MAX_INTERACTIONS = 10;

export interface Interaction {
  interactionId: number | undefined;
  duration: number;
  startTime: number;
  processingTime: number;
  processingStart: number;
  processingEnd: number;
  selector: string | null;
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
    const { duration, startTime, interactionId, processingStart, processingEnd, target } = entry;
    const processingTime = processingEnd - processingStart;
    const existingEntry = slowestEntriesMap[interactionId!];
    const selector = target ? getNodeSelector(target) : null;

    if (existingEntry) {
      console.log("Existing interaction", {
        name: entry.name,
        interactionId: entry.interactionId,
        duration: entry.duration,
      });
      const longerDuration = duration > existingEntry.duration;
      const sameWithLongerProcessingTime =
        duration === existingEntry.duration && processingTime > existingEntry.processingTime;

      if (longerDuration || sameWithLongerProcessingTime) {
        console.log("Replacing existing interaction", {
          longerDuration,
          sameWithLongerProcessingTime,
        });
        // Only replace an existing interation if the duration is longer, or if the duration is the
        // same but the processing time is longer. The logic around this is that the interaction with
        // longer processing time is likely to be the event that actually had a handler.
        existingEntry.duration = duration;
        existingEntry.startTime = startTime;
        existingEntry.processingStart = processingStart;
        existingEntry.processingEnd = processingEnd;
        existingEntry.processingTime = processingTime;
        existingEntry.selector = selector;
      } else {
        console.log("Ignoring this interaction");
      }
    } else {
      console.log("New interaction", {
        name: entry.name,
        interactionId: entry.interactionId,
        duration: entry.duration,
      });
      interactionCountEstimate++;
      slowestEntriesMap[interactionId!] = {
        duration,
        interactionId,
        startTime,
        processingStart,
        processingEnd,
        processingTime,
        selector,
      };
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
export function getHighPercentileInteraction(): Interaction | undefined {
  const index = Math.min(slowestEntries.length - 1, Math.floor(getInteractionCount() / 50));

  return slowestEntries[index];
}

export function getInteractionCount(): number {
  if ("interactionCount" in performance) {
    return performance.interactionCount;
  }

  return interactionCountEstimate;
}

export function getSlowestEntries() {
  return slowestEntries;
}
