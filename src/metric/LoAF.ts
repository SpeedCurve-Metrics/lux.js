import { UserConfig } from "../config";
import { clamp, floor, max } from "../math";
import * as PROPS from "../minification";
import { INPPhase } from "./INP";

export type LoAFSummary = {
  totalEntries: number;
  totalDuration: number;
  totalBlockingDuration: number;
  totalStyleAndLayoutDuration: number;
  totalWorkDuration: number;
  entries: LoAFEntry[];
  scripts: LoAFScriptSummary[];
};

export type LoAFEntry = {
  startTime: number;
  duration: number;
  renderStart: number;
  styleAndLayoutStart: number;
  blockingDuration: number;
};

export type LoAFScriptSummary = {
  sourceUrl: string;
  sourceFunctionName: string;
  timings: Array<[number, number]>; // [startTime, duration]
  totalEntries: number;
  totalDuration: number;
  totalBlockingDuration: number;
  totalPauseDuration: number;
  totalForcedStyleAndLayoutDuration: number;
  invoker: string;
  inpPhase?: INPPhase;
};

let entries: PerformanceLongAnimationFrameTiming[] = [];

export function processEntry(entry: PerformanceLongAnimationFrameTiming): void {
  entries.push(entry);
}

export function reset(): void {
  entries = [];
}

export function getEntries(): PerformanceLongAnimationFrameTiming[] {
  return entries;
}

export function getData(config: UserConfig): LoAFSummary {
  const summarizedEntries: LoAFEntry[] = [];
  let totalDuration = 0;
  let totalBlockingDuration = 0;
  let totalStyleAndLayoutDuration = 0;
  let totalWorkDuration = 0;

  entries.forEach((entry) => {
    const { startTime, blockingDuration, duration, renderStart, styleAndLayoutStart } = entry;

    totalDuration += duration;
    totalBlockingDuration += blockingDuration;
    totalStyleAndLayoutDuration += styleAndLayoutStart
      ? clamp(startTime + duration - styleAndLayoutStart)
      : 0;
    totalWorkDuration += renderStart ? renderStart - startTime : duration;

    summarizedEntries.push({
      startTime: floor(startTime),
      duration: floor(duration),
      renderStart: floor(renderStart),
      styleAndLayoutStart: floor(styleAndLayoutStart),
      blockingDuration: floor(blockingDuration),
    });
  });

  return {
    totalBlockingDuration: floor(totalBlockingDuration),
    totalDuration: floor(totalDuration),
    totalEntries: entries[PROPS._length],
    totalStyleAndLayoutDuration: floor(totalStyleAndLayoutDuration),
    totalWorkDuration: floor(totalWorkDuration),

    scripts: summarizeLoAFScripts(
      entries.flatMap((entry) => entry.scripts),
      config,
    ),

    // Only keep the slowest LoAF entries
    entries: summarizedEntries
      .sort((a, b) => b[PROPS._duration] - a[PROPS._duration])
      .slice(0, config.maxAttributionEntries)
      .sort((a, b) => a[PROPS._startTime] - b[PROPS._startTime]),
  };
}

type ScriptWithINPPhase = PerformanceScriptTiming & { inpPhase?: INPPhase };

export function summarizeLoAFScripts(
  scripts: PerformanceScriptTiming[],
  config: UserConfig,
): LoAFScriptSummary[] {
  const summary: Record<string, LoAFScriptSummary> = {};

  scripts.forEach((script) => {
    const key = script.sourceURL;
    if (!summary[key]) {
      summary[key] = {
        sourceUrl: script.sourceURL,
        sourceFunctionName: "",
        timings: [],
        totalEntries: 0,
        totalDuration: 0,
        totalBlockingDuration: 0,
        totalPauseDuration: 0,
        totalForcedStyleAndLayoutDuration: 0,
        invoker: "",
        inpPhase: (script as ScriptWithINPPhase).inpPhase,
      };
    }

    summary[key].totalEntries++;
    summary[key][PROPS._totalDuration] += script[PROPS._duration];
    summary[key].totalBlockingDuration += max(0, script[PROPS._duration] - 50);
    summary[key].totalPauseDuration += script.pauseDuration;
    summary[key].totalForcedStyleAndLayoutDuration += script.forcedStyleAndLayoutDuration;
    summary[key].timings.push([floor(script[PROPS._startTime]), floor(script[PROPS._duration])]);
  });

  return Object.values(summary)
    .map((script) => ({
      ...script,
      totalDuration: floor(script[PROPS._totalDuration]),
      totalPauseDuration: floor(script.totalPauseDuration),
      totalForcedStyleAndLayoutDuration: floor(script.totalForcedStyleAndLayoutDuration),
    }))
    .sort((a, b) => b[PROPS._totalDuration] - a[PROPS._totalDuration])
    .slice(0, config.maxAttributionEntries);
}
