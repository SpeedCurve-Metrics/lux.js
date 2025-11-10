import { BeaconMetricData, BeaconMetricKey } from "../beacon";
import { UserConfig } from "../config";
import { getNodeSelector } from "../dom";
import { clamp, floor, max } from "../math";
import * as PROPS from "../minification";
import { performance } from "../performance";
import { processTimeMetric } from "../timing";
import { getEntries as getLoAFEntries, summarizeLoAFScripts } from "./LoAF";

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

export enum INPPhase {
  InputDelay = "ID",
  ProcessingTime = "PT",
  PresentationDelay = "PD",
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
  if (entry.interactionId || (entry[PROPS.entryType] === "first-input" && !entryExists(entry))) {
    const { duration, startTime, interactionId, name, processingStart, processingEnd, target } =
      entry;

    if (duration < 0) {
      return;
    }

    const processingTime = processingEnd - processingStart;
    const existingEntry = slowestEntriesMap[interactionId!];
    const selector = target ? getNodeSelector(target) : null;

    if (existingEntry) {
      const longerDuration = duration > existingEntry[PROPS.duration];
      const sameWithLongerProcessingTime =
        duration === existingEntry[PROPS.duration] &&
        processingTime > existingEntry[PROPS.processingTime];

      if (longerDuration || sameWithLongerProcessingTime) {
        // Only replace an existing interation if the duration is longer, or if the duration is the
        // same but the processing time is longer. The logic around this is that the interaction with
        // longer processing time is likely to be the event that actually had a handler.
        existingEntry[PROPS.duration] = duration;
        existingEntry[PROPS.name] = name;
        existingEntry[PROPS.processingEnd] = processingEnd;
        existingEntry[PROPS.processingStart] = processingStart;
        existingEntry[PROPS.processingTime] = processingTime;
        existingEntry[PROPS.selector] = selector;
        existingEntry[PROPS.startTime] = startTime;
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
      slowestEntries[PROPS.push](slowestEntriesMap[interactionId!]);
    }

    // Only store the longest <MAX_INTERACTIONS> interactions
    slowestEntries.sort((a, b) => b[PROPS.duration] - a[PROPS.duration]);
    slowestEntries.splice(MAX_INTERACTIONS).forEach((entry) => {
      delete slowestEntriesMap[entry.interactionId!];
    });
  }
}

function entryExists(e1: PerformanceEntry): boolean {
  return slowestEntries.some(
    (e2) =>
      e1[PROPS.startTime] === e2[PROPS.startTime] && e1[PROPS.duration] === e2[PROPS.duration],
  );
}

/**
 * Returns an estimated high percentile INP value based on the total number of interactions on the
 * current page.
 */
export function getHighPercentileInteraction(): Interaction | undefined {
  const index = Math.min(slowestEntries[PROPS.length] - 1, Math.floor(getInteractionCount() / 50));

  return slowestEntries[index];
}

export function getData(config: UserConfig): BeaconMetricData[BeaconMetricKey.INP] | undefined {
  const interaction = getHighPercentileInteraction();

  if (!interaction) {
    return undefined;
  }

  const { duration, startTime, processingStart } = interaction;

  const inpScripts = getLoAFEntries()
    .flatMap((entry) => entry.scripts)
    // Only include scripts that started during the interaction
    .filter(
      (script) =>
        script[PROPS.startTime] + script[PROPS.duration] >= startTime &&
        script[PROPS.startTime] <= startTime + duration,
    )
    .map((_script) => {
      const script = JSON.parse(JSON.stringify(_script));

      // Clamp the script duration to the time of the interaction
      script[PROPS.duration] =
        script[PROPS.startTime] + script[PROPS.duration] - max(startTime, script[PROPS.startTime]);
      script.inpPhase = getINPPhase(script, interaction);

      return script as PerformanceScriptTiming;
    });

  const loafScripts = summarizeLoAFScripts(inpScripts, config);

  return {
    value: interaction[PROPS.duration],
    startTime: processTimeMetric(startTime),
    duration: interaction[PROPS.duration],
    subParts: {
      inputDelay: clamp(floor(processingStart - startTime)),
      processingStart: processTimeMetric(processingStart),
      processingEnd: processTimeMetric(interaction[PROPS.processingEnd]),
      processingTime: clamp(floor(interaction[PROPS.processingTime])),
      presentationDelay: clamp(
        floor(startTime + interaction[PROPS.duration] - interaction[PROPS.processingEnd]),
      ),
    },
    attribution: {
      eventType: interaction[PROPS.name],
      elementSelector: interaction[PROPS.selector] || null,
      elementType: interaction.target?.nodeName || null,
      loafScripts,
    },
  };
}

export function getINPPhase(script: PerformanceScriptTiming, interaction: Interaction): INPPhase {
  const { processingStart, processingTime, startTime } = interaction;
  const inputDelay = processingStart - startTime;

  if (script[PROPS.startTime] < startTime + inputDelay) {
    return INPPhase.InputDelay;
  } else if (script[PROPS.startTime] >= startTime + inputDelay + processingTime) {
    return INPPhase.PresentationDelay;
  }

  return INPPhase.ProcessingTime;
}

function getInteractionCount(): number {
  if ("interactionCount" in performance) {
    return performance.interactionCount;
  }

  return interactionCountEstimate;
}
