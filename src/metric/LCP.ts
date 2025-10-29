import { BeaconMetricData, BeaconMetricKey, MetricAttribution, shouldReportValue } from "../beacon";
import { getNodeSelector } from "../dom";
import { clamp, floor, max } from "../math";
import * as PROPS from "../minification";
import { getEntriesByType, getNavigationEntry, timing } from "../performance";
import { processTimeMetric } from "../timing";

let lcpEntry: LargestContentfulPaint | undefined;
let lcpAttribution: MetricAttribution | null = null;

export function processEntry(entry: LargestContentfulPaint) {
  if (!lcpEntry || entry[PROPS._startTime] > lcpEntry[PROPS._startTime]) {
    lcpEntry = entry;
    lcpAttribution = entry.element
      ? {
          elementSelector: getNodeSelector(entry.element),
          elementType: entry.element.nodeName,
        }
      : null;
  }
}

export function reset(): void {
  lcpEntry = undefined;
  lcpAttribution = null;
}

export function getData(): BeaconMetricData[BeaconMetricKey.LCP] | undefined {
  if (!lcpEntry) {
    return undefined;
  }

  let subParts = null;

  if (lcpEntry.url) {
    const lcpResource = getEntriesByType("resource").find(
      (resource) => resource[PROPS._name] === lcpEntry!.url,
    ) as PerformanceResourceTiming;

    if (lcpResource) {
      const navEntry = getNavigationEntry();
      const responseStart = navEntry.responseStart || timing.responseStart;
      const activationStart = navEntry.activationStart;
      const ttfb = max(0, responseStart - activationStart);

      const lcpStartTime = lcpResource[PROPS._startTime];
      const lcpRequestStart = (lcpResource.requestStart || lcpStartTime) - activationStart;
      const lcpResponseEnd = max(lcpRequestStart, lcpResource.responseEnd - activationStart);
      const lcpRenderTime = max(lcpResponseEnd, lcpStartTime - activationStart);

      subParts = {
        resourceLoadDelay: clamp(floor(lcpRequestStart - ttfb)),
        resourceLoadTime: clamp(floor(lcpResponseEnd - lcpRequestStart)),
        elementRenderDelay: clamp(floor(lcpRenderTime - lcpResponseEnd)),
      };
    }
  }

  const value = lcpEntry[PROPS._startTime];

  if (!shouldReportValue(value)) {
    // It's possible the LCP entry we have occurred before the current page was initialised. In
    // this case, we don't want to report the LCP value.
    return undefined;
  }

  return {
    value: processTimeMetric(value),
    subParts,
    attribution: lcpAttribution,
  };
}
