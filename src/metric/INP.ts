import { BeaconMetricData, BeaconMetricKey } from "../beacon";
import { UserConfig } from "../config";
import * as Const from "../constants";
import { getNodeSelector } from "../dom";
import { clamp, floor, max } from "../math";
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
  if (entry.interactionId || (entry.entryType === "first-input" && !entryExists(entry))) {
    const duration = entry[Const.duration];
    const startTime = entry[Const.startTime];
    const interactionId = entry.interactionId;
    const name = entry[Const.name];
    const processingStart = entry[Const.processingStart];
    const processingEnd = entry[Const.processingEnd];
    const target = entry[Const.target];

    if (duration < 0) {
      return;
    }

    const processingTime = processingEnd - processingStart;
    const existingEntry = slowestEntriesMap[interactionId!];
    const selector = target ? getNodeSelector(target) : null;

    if (existingEntry) {
      const longerDuration = duration > existingEntry[Const.duration];
      const sameWithLongerProcessingTime =
        duration === existingEntry[Const.duration] &&
        processingTime > existingEntry[Const.processingTime];

      if (longerDuration || sameWithLongerProcessingTime) {
        // Only replace an existing interation if the duration is longer, or if the duration is the
        // same but the processing time is longer. The logic around this is that the interaction with
        // longer processing time is likely to be the event that actually had a handler.
        existingEntry[Const.duration] = duration;
        existingEntry[Const.name] = name;
        existingEntry[Const.processingEnd] = processingEnd;
        existingEntry[Const.processingStart] = processingStart;
        existingEntry[Const.processingTime] = processingTime;
        existingEntry[Const.selector] = selector;
        existingEntry[Const.startTime] = startTime;
        existingEntry[Const.target] = target;
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
    slowestEntries.sort((a, b) => b[Const.duration] - a[Const.duration]);
    slowestEntries.splice(MAX_INTERACTIONS).forEach((entry) => {
      delete slowestEntriesMap[entry.interactionId!];
    });
  }
}

function entryExists(e1: PerformanceEntry): boolean {
  return slowestEntries.some(
    (e2) =>
      e1[Const.startTime] === e2[Const.startTime] && e1[Const.duration] === e2[Const.duration],
  );
}

/**
 * Returns an estimated high percentile INP value based on the total number of interactions on the
 * current page.
 */
export function getHighPercentileInteraction(): Interaction | undefined {
  const index = Math.min(slowestEntries.length - 1, Math.floor(getInteractionCount() / 50));

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
        script[Const.startTime] + script[Const.duration] >= startTime &&
        script[Const.startTime] <= startTime + duration,
    )
    .map((_script) => {
      const script = JSON.parse(JSON.stringify(_script));

      // Clamp the script duration to the time of the interaction
      script[Const.duration] =
        script[Const.startTime] + script[Const.duration] - max(startTime, script[Const.startTime]);
      script.inpPhase = getINPPhase(script, interaction);

      return script as PerformanceScriptTiming;
    });

  const loafScripts = summarizeLoAFScripts(inpScripts, config);

  return {
    value: interaction[Const.duration],
    startTime: processTimeMetric(startTime),
    duration: interaction[Const.duration],
    subParts: {
      inputDelay: clamp(floor(processingStart - startTime)),
      processingStart: processTimeMetric(processingStart),
      processingEnd: processTimeMetric(interaction[Const.processingEnd]),
      processingTime: clamp(floor(interaction[Const.processingTime])),
      presentationDelay: clamp(
        floor(startTime + interaction[Const.duration] - interaction[Const.processingEnd]),
      ),
    },
    attribution: {
      eventType: interaction[Const.name],
      elementSelector: interaction[Const.selector] || null,
      elementType: interaction[Const.target]?.nodeName || null,
      loafScripts,
    },
  };
}

export function getINPPhase(script: PerformanceScriptTiming, interaction: Interaction): INPPhase {
  const { processingStart, processingTime, startTime } = interaction;
  const inputDelay = processingStart - startTime;

  if (script.startTime < startTime + inputDelay) {
    return INPPhase.InputDelay;
  } else if (script.startTime >= startTime + inputDelay + processingTime) {
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
