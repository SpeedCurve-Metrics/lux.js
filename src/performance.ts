import { floor } from "./math";
import now from "./now";
import scriptStartTime from "./start-marker";

// If the various performance APIs aren't available, we export an empty object to
// prevent having to make regular typeof checks.
export const performance = window.performance || {};
export const timing = performance.timing || {
  // If performance.timing isn't available, we attempt to polyfill the navigationStart value.
  // Our first attempt is from LUX.ns, which is the time that the snippet execution began. If this
  // is not available, we fall back to the time that the current script execution began.
  navigationStart: window.LUX?.ns || scriptStartTime,
};

// Older PerformanceTiming implementations allow for arbitrary keys to exist on the timing object
export type PerfTimingKey = keyof Omit<PerformanceTiming, "toJSON">;

export function msSinceNavigationStart(): number {
  if (performance.now) {
    return floor(performance.now());
  }

  return now() - timing.navigationStart;
}

export function navigationType() {
  if (performance.navigation && typeof performance.navigation.type !== "undefined") {
    return performance.navigation.type;
  }

  return "";
}

type PartialPerformanceNavigationTiming = Partial<PerformanceNavigationTiming> & {
  [key: string]: number | string;
  navigationStart: number;
  activationStart: number;
  startTime: number;
  type: PerformanceNavigationTiming["type"];
};

export function getNavigationEntry(): PartialPerformanceNavigationTiming {
  const navEntries = getEntriesByType("navigation") as PerformanceNavigationTiming[];

  if (navEntries.length) {
    const entry = navEntries[0] as PartialPerformanceNavigationTiming;

    entry.navigationStart = 0;

    if (typeof entry.activationStart === "undefined") {
      entry.activationStart = 0;
    }

    return entry;
  }

  const navType = navigationType();
  const entry: PartialPerformanceNavigationTiming = {
    navigationStart: 0,
    activationStart: 0,
    startTime: 0,
    type: navType == 2 ? "back_forward" : navType === 1 ? "reload" : "navigate",
  };

  if (__ENABLE_POLYFILLS) {
    for (const key in timing) {
      if (typeof timing[key as PerfTimingKey] === "number" && key !== "navigationStart") {
        entry[key] = Math.max(0, timing[key as PerfTimingKey] - timing.navigationStart);
      }
    }
  }

  return entry;
}

/**
 * Simple wrapper around performance.getEntriesByType to provide fallbacks for
 * legacy browsers, and work around edge cases where undefined is returned instead
 * of an empty PerformanceEntryList.
 */
export function getEntriesByType(type: string): PerformanceEntryList {
  if (typeof performance.getEntriesByType === "function") {
    const entries = performance.getEntriesByType(type);

    if (entries && entries.length) {
      return entries;
    }
  }

  return [];
}
