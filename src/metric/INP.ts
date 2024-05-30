import { MetricData } from "../beacon";
import { getNodeSelector } from "../dom";
import { clamp, floor } from "../math";
import { performance } from "../performance";

/**
 * This implementation is based on the web-vitals implementation, however it is stripped back to the
 * bare minimum required to measure just the INP value and does not store the actual event entries.
 */

// The maximum number of interactions to store
const MAX_INTERACTIONS = 10;

export interface Interaction {
  duration: number;
  interactionId: number | undefined;
  name: string;
  processingEnd: number;
  processingStart: number;
  processingTime: number;
  selector: string | null;
  startTime: number;
  target: Node | null;
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

export function processEntry(entry: PerformanceEventTiming): void {
  if (entry.interactionId || (entry.entryType === "first-input" && !entryExists(entry))) {
    const { duration, startTime, interactionId, name, processingStart, processingEnd, target } =
      entry;
    const processingTime = processingEnd - processingStart;
    const existingEntry = slowestEntriesMap[interactionId!];
    const selector = target ? getNodeSelector(target) : null;

    if (existingEntry) {
      const longerDuration = duration > existingEntry.duration;
      const sameWithLongerProcessingTime =
        duration === existingEntry.duration && processingTime > existingEntry.processingTime;

      if (longerDuration || sameWithLongerProcessingTime) {
        // Only replace an existing interation if the duration is longer, or if the duration is the
        // same but the processing time is longer. The logic around this is that the interaction with
        // longer processing time is likely to be the event that actually had a handler.
        existingEntry.duration = duration;
        existingEntry.name = name;
        existingEntry.processingEnd = processingEnd;
        existingEntry.processingStart = processingStart;
        existingEntry.processingTime = processingTime;
        existingEntry.selector = selector;
        existingEntry.startTime = startTime;
        existingEntry.target = target;
      }
    } else {
      interactionCountEstimate++;
      slowestEntriesMap[interactionId!] = {
        duration,
        interactionId,
        name,
        processingEnd,
        processingStart,
        processingTime,
        selector,
        startTime,
        target,
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

export function getData(): MetricData["inp"] | undefined {
  const interaction = getHighPercentileInteraction();

  if (!interaction) {
    return undefined;
  }

  return {
    value: interaction.duration,
    startTime: floor(interaction.startTime),
    subParts: {
      inputDelay: clamp(floor(interaction.processingStart - interaction.startTime)),
      processingTime: clamp(floor(interaction.processingTime)),
      presentationDelay: clamp(
        floor(interaction.startTime + interaction.duration - interaction.processingEnd),
      ),
    },
    attribution: interaction.selector
      ? {
          elementSelector: interaction.selector,
          elementType: interaction.target?.nodeName || "",
          eventType: interaction.name,
        }
      : null,
  };
}

function getInteractionCount(): number {
  if ("interactionCount" in performance) {
    return performance.interactionCount;
  }

  return interactionCountEstimate;
}
