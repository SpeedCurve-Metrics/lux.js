import { clamp, floor, max } from "../math";
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

const MAX_LOAF_ENTRIES = 50;
const MAX_LOAF_SCRIPTS = 50;
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

export function getData(): LoAFSummary {
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
    totalEntries: entries.length,
    totalStyleAndLayoutDuration: floor(totalStyleAndLayoutDuration),
    totalWorkDuration: floor(totalWorkDuration),
    entries: summarizedEntries.slice(0, MAX_LOAF_ENTRIES),
    scripts: summarizeLoAFScripts(entries.flatMap((entry) => entry.scripts)).slice(
      0,
      MAX_LOAF_SCRIPTS,
    ),
  };
}

type ScriptWithINPPhase = PerformanceScriptTiming & { inpPhase?: INPPhase };

export function summarizeLoAFScripts(scripts: PerformanceScriptTiming[]): LoAFScriptSummary[] {
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
    summary[key].totalDuration += script.duration;
    summary[key].totalBlockingDuration += max(0, script.duration - 50);
    summary[key].totalPauseDuration += script.pauseDuration;
    summary[key].totalForcedStyleAndLayoutDuration += script.forcedStyleAndLayoutDuration;
    summary[key].timings.push([floor(script.startTime), floor(script.duration)]);
  });

  return Object.values(summary).map((script) => ({
    ...script,
    totalDuration: floor(script.totalDuration),
    totalPauseDuration: floor(script.totalPauseDuration),
    totalForcedStyleAndLayoutDuration: floor(script.totalForcedStyleAndLayoutDuration),
  }));
}
