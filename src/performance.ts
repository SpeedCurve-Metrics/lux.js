const perf = window.performance;

/**
 * Simple wrapper around performance.getEntriesByType to provide fallbacks for
 * legacy browsers, and work around edge cases where undefined is returned instead
 * of an empty PerformanceEntryList.
 */
export function getEntriesByType(type: string): PerformanceEntryList {
  if (typeof perf !== "undefined") {
    if (typeof perf.getEntriesByType === "function") {
      const entries = perf.getEntriesByType(type);

      if (entries && entries.length) {
        return entries;
      }
    } else if (typeof perf.webkitGetEntriesByType === "function") {
      const entries = perf.webkitGetEntriesByType(type);

      if (entries && entries.length) {
        return entries;
      }
    }
  }

  return [];
}
