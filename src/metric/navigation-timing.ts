import { START_MARK } from "../constants";
import { getNavigationEntry } from "../performance";
import { processTimeMetric } from "../timing";
import { KeysByType, Writable } from "../types";

type NavTimingEntry = Writable<PerformanceNavigationTiming> & {
  activationStart: number;
  navigationStart: number;
};

type NavTimingKey =
  | keyof KeysByType<NavTimingEntry, number>
  | keyof KeysByType<NavTimingEntry, string>;

export type NavigationTimingData = Pick<NavTimingEntry, NavTimingKey>;

export function getData(): NavigationTimingData | undefined {
  const startMark = performance.getEntriesByName(START_MARK).pop();

  if (startMark) {
    // Don't report navigation timing in SPA beacons
    return undefined;
  }

  const navEntry = getNavigationEntry();
  const entry: Record<string, string | number> = {};

  for (const k in navEntry) {
    const value = navEntry[k];

    if (typeof value === "number") {
      entry[k as keyof NavTimingEntry] = processTimeMetric(value);
    } else if (typeof value === "string") {
      entry[k as keyof NavTimingEntry] = value;
    }
  }

  return entry as NavigationTimingData;
}
