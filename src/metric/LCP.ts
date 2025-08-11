import { BeaconMetricData, BeaconMetricKey, shouldReportValue } from "../beacon";
import * as Const from "../constants";
import { getNodeSelector } from "../dom";
import { clamp, floor, max } from "../math";
import { getEntriesByType, getNavigationEntry, timing } from "../performance";
import { processTimeMetric } from "../timing";

let lcpEntry: LargestContentfulPaint | undefined;

export function processEntry(entry: LargestContentfulPaint) {
  if (!lcpEntry || entry[Const.startTime] > lcpEntry[Const.startTime]) {
    lcpEntry = entry;
  }
}

export function reset(): void {
  lcpEntry = undefined;
}

export function getData(): BeaconMetricData[BeaconMetricKey.LCP] | undefined {
  if (!lcpEntry) {
    return undefined;
  }

  let subParts = null;

  if (lcpEntry.url) {
    const lcpResource = getEntriesByType("resource").find(
      (resource) => resource[Const.name] === lcpEntry!.url,
    ) as PerformanceResourceTiming;

    if (lcpResource) {
      const navEntry = getNavigationEntry();
      const responseStart = navEntry.responseStart || timing.responseStart;
      const activationStart = navEntry.activationStart;
      const ttfb = max(0, responseStart - activationStart);

      const lcpStartTime = lcpResource[Const.startTime];
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

  const value = lcpEntry[Const.startTime];

  if (!shouldReportValue(value)) {
    // It's possible the LCP entry we have occurred before the current page was initialised. In
    // this case, we don't want to report the LCP value.
    return undefined;
  }

  return {
    value: processTimeMetric(value),
    subParts,
    attribution: lcpEntry.element
      ? {
          elementSelector: getNodeSelector(lcpEntry.element),
          elementType: lcpEntry.element.nodeName,
        }
      : null,
  };
}
