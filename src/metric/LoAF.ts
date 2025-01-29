import { BeaconMetricData, BeaconMetricKey } from "../beacon";

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
  sourceURL: string;
  sourceFunctionName: string;
  totalDuration: number;
  totalForcedStyleAndLayoutDuration: number;
  invoker: string;
};

let entries: PerformanceLongAnimationFrameTiming[] = [];

export function processEntry(entry: PerformanceLongAnimationFrameTiming): void {
  entries.push(entry);
}

export function reset(): void {
  entries = [];
}

export function getData(): LoAFSummary {
  const scripts: Record<string, LoAFScriptSummary> = {};
  const data: LoAFSummary = {
    totalBlockingDuration: 0,
    totalDuration: 0,
    totalEntries: entries.length,
    totalStyleAndLayoutDuration: 0,
    totalWorkDuration: 0,
    entries: [],
    scripts: [],
  };

  entries.forEach((entry) => {
    const { startTime, blockingDuration, duration, renderStart, styleAndLayoutStart } = entry;

    data.totalDuration += duration;
    data.totalBlockingDuration += blockingDuration;
    data.totalStyleAndLayoutDuration += styleAndLayoutStart
      ? startTime + duration - styleAndLayoutStart
      : 0;
    data.totalWorkDuration += renderStart ? renderStart - startTime : duration;

    data.entries.push({
      startTime,
      duration,
      renderStart,
      styleAndLayoutStart,
      blockingDuration,
    });

    entry.scripts.forEach((script) => {
      const key = script.invoker + ":" + script.sourceURL + ":" + script.sourceFunctionName;
      if (!scripts[key]) {
        scripts[key] = {
          sourceURL: script.sourceURL,
          sourceFunctionName: script.sourceFunctionName,
          totalDuration: 0,
          totalForcedStyleAndLayoutDuration: 0,
          invoker: script.invoker,
        };
      }

      scripts[key].totalDuration += script.duration;
      scripts[key].totalForcedStyleAndLayoutDuration += script.forcedStyleAndLayoutDuration;
    });
  });

  data.scripts = Object.values(scripts);

  return data;
}
