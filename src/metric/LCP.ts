import { MetricData } from "../beacon";
import { getNodeSelector } from "../dom";
import { clamp, floor } from "../math";
import { getNavigationEntry, timing } from "../performance";
import { processTimeMetric } from "../timing";

let lcpEntry: LargestContentfulPaint | undefined;

export function processEntry(entry: LargestContentfulPaint) {
  if (!lcpEntry || entry.startTime > lcpEntry.startTime) {
    lcpEntry = entry;
  }
}

export function reset(): void {
  lcpEntry = undefined;
}

export function getData(): MetricData["lcp"] | undefined {
  if (!lcpEntry) {
    return undefined;
  }

  let resourceLoadDelay: number | null = null;
  let resourceLoadTime: number | null = null;
  let elementRenderDelay: number | null = null;

  if (lcpEntry.url) {
    const lcpResource = performance
      .getEntriesByType("resource")
      .find((resource) => resource.name === lcpEntry!.url) as PerformanceResourceTiming;

    if (lcpResource) {
      const navEntry = getNavigationEntry();
      const responseStart = navEntry.responseStart || timing.responseStart;
      const activationStart = navEntry.activationStart;
      const ttfb = Math.max(0, responseStart - activationStart);

      const lcpStartTime = lcpResource.startTime;
      const lcpRequestStart = (lcpResource.requestStart || lcpStartTime) - activationStart;
      const lcpResponseEnd = Math.max(lcpRequestStart, lcpResource.responseEnd - activationStart);
      const lcpRenderTime = Math.max(lcpResponseEnd, lcpStartTime - activationStart);

      resourceLoadDelay = clamp(floor(lcpRequestStart - ttfb));
      resourceLoadTime = clamp(floor(lcpResponseEnd - lcpRequestStart));
      elementRenderDelay = clamp(floor(lcpRenderTime - lcpResponseEnd));
    }
  }

  return {
    value: processTimeMetric(lcpEntry.startTime),
    subParts: { resourceLoadDelay, resourceLoadTime, elementRenderDelay },
    attribution: {
      elementSelector: getNodeSelector(lcpEntry.element),
      elementType: lcpEntry.element.nodeName,
    },
  };
}
