type PerformanceEntryMap = {
  longtask: PerformanceLongTaskTiming;
  element: PerformanceElementTiming;
  event: PerformanceEventTiming;
  "first-input": PerformanceEventTiming;
  "largest-contentful-paint": LargestContentfulPaint;
  "layout-shift": LayoutShift;
  paint: PerformancePaintTiming;
};

export const ALL_ENTRIES: PerformanceEntry[] = [];

export function observe<K extends keyof PerformanceEntryMap>(
  type: K,
  callback: (entry: PerformanceEntryMap[K]) => void,
  options?: PerformanceObserverInit
): PerformanceObserver | undefined {
  if (
    typeof PerformanceObserver === "function" &&
    PerformanceObserver.supportedEntryTypes.includes(type)
  ) {
    const po = new PerformanceObserver((list) => {
      list.getEntries().forEach((entry) => callback(entry as PerformanceEntryMap[K]));
    });

    po.observe({ type, buffered: true, ...options });

    return po;
  }

  return undefined;
}

export function getEntries<K extends keyof PerformanceEntryMap>(
  type: K
): Array<PerformanceEntryMap[K]> {
  return ALL_ENTRIES.filter((entry) => entry.entryType === type) as Array<PerformanceEntryMap[K]>;
}

export function addEntry(entry: PerformanceEntry) {
  ALL_ENTRIES.push(entry);
}

export function clearEntries() {
  ALL_ENTRIES.splice(0);
}
