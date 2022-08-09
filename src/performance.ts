import scriptStartTime from "./start-marker";
import now from "./now";

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
    return performance.now();
  }

  return now() - timing.navigationStart;
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
