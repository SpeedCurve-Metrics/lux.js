import { floor } from "./math";
import scriptStartTime from "./start-marker";

// If the various performance APIs aren't available, we export an empty object to
// prevent having to make regular typeof checks.
export const performance = window.performance || {};
export const timing = performance.timing || {
  activationStart: 0,
  // If performance.timing isn't available, we attempt to polyfill the navigationStart value.
  // Our first attempt is from LUX.ns, which is the time that the snippet execution began. If this
  // is not available, we fall back to the time that the current script execution began.
  navigationStart: window.LUX?.ns || scriptStartTime,
};

// Older PerformanceTiming implementations allow for arbitrary keys to exist on the timing object
export type PerfTimingKey = keyof Omit<PerformanceTiming, "toJSON">;

export function navigationType() {
  if (performance.navigation && typeof performance.navigation.type !== "undefined") {
    return performance.navigation.type;
  }

  return "";
}

/**
 * Returns the delivery type for the current document. To differentiate between the valid empty
 * string value and browsers that don't support PerformanceResourceTiming.deliveryType, we convert
 * the empty string value to "(empty string)". Browsers that don't support deliveryType will return
 * null. Despite straying from the spec, this allows us to differentiate between the two cases.
 *
 * @see https://w3c.github.io/resource-timing/#dom-performanceresourcetiming-deliverytype
 */
export function deliveryType(): string | undefined {
  const navEntry = getNavigationEntry();

  if ("deliveryType" in navEntry) {
    return navEntry.deliveryType || "(empty string)";
  }

  return undefined;
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
    const nativeEntry = navEntries[0] as PartialPerformanceNavigationTiming;
    const entry = {
      navigationStart: 0,
      activationStart: 0,
    } as PartialPerformanceNavigationTiming;

    for (const key in nativeEntry) {
      entry[key] = nativeEntry[key];
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
        entry[key] = floor(timing[key as PerfTimingKey] - timing.navigationStart);
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

/**
 * Simple wrapper around performance.getEntriesByName to provide fallbacks for
 * legacy browsers, and work around edge cases where undefined is returned instead
 * of an empty PerformanceEntryList.
 */
export function getEntriesByName(type: string): PerformanceEntryList {
  if (typeof performance.getEntriesByName === "function") {
    const entries = performance.getEntriesByName(type);

    if (entries && entries.length) {
      return entries;
    }
  }

  return [];
}
