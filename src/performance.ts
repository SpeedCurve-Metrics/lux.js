// If the various performance APIs aren't available, we export an empty object to
// prevent having to make regular typeof checks.
export const performance = window.performance || {};
export const timing = performance.timing || {};

// Older PerformanceTiming implementations allow for arbitrary keys to exist on the timing object
export type PerfTimingKey = keyof Omit<PerformanceTiming, "toJSON">;

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
  } else if (typeof performance.webkitGetEntriesByType === "function") {
    const entries = performance.webkitGetEntriesByType(type);

    if (entries && entries.length) {
      return entries;
    }
  }

  return [];
}
