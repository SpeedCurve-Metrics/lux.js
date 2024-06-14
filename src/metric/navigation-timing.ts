import { getNavigationEntry } from "../performance";
import { processTimeMetric } from "../timing";

let currentNavigation: PerformanceNavigationTiming;

export type NavigationTimingData = {
  activationStart: number;
  connectEnd: number;
  connectStart: number;
  decodedBodySize?: number;
  domainLookupEnd: number;
  domainLookupStart: number;
  domComplete?: number;
  domContentLoadedEventEnd?: number;
  domContentLoadedEventStart?: number;
  domInteractive?: number;
  encodedBodySize?: number;
  fetchStart: number;
  loadEventEnd?: number;
  loadEventStart?: number;
  redirectCount: number;
  redirectEnd?: number;
  redirectStart?: number;
  requestStart?: number;
  responseEnd?: number;
  responseStart?: number;
  secureConnectionStart?: number;
  transferSize?: number;
};

export function processEntry(entry: PerformanceNavigationTiming): void {
  currentNavigation = entry;
}

export function getData(): NavigationTimingData {
  const fallbackNavEntry = getNavigationEntry();

  function processNavTimingValue(key: string, allowZero?: false): number | undefined;
  function processNavTimingValue(key: string, allowZero: true): number;
  function processNavTimingValue(key: string, allowZero?: boolean): number | undefined {
    let value = 0;

    if (key in currentNavigation) {
      value = currentNavigation[key as keyof NavigationTimingData] as number;
    } else if (key in fallbackNavEntry) {
      value = fallbackNavEntry[key] as number;
    }

    if (value === 0 && !allowZero) {
      return undefined;
    }

    return processTimeMetric(value);
  }

  return {
    activationStart: processNavTimingValue("activationStart", true),
    connectEnd: processNavTimingValue("connectEnd", true),
    connectStart: processNavTimingValue("connectStart", true),
    decodedBodySize: processNavTimingValue("decodedBodySize"),
    domainLookupEnd: processNavTimingValue("domainLookupEnd", true),
    domainLookupStart: processNavTimingValue("domainLookupStart", true),
    domComplete: processNavTimingValue("domComplete"),
    domContentLoadedEventEnd: processNavTimingValue("domContentLoadedEventEnd"),
    domContentLoadedEventStart: processNavTimingValue("domContentLoadedEventStart"),
    domInteractive: processNavTimingValue("domInteractive"),
    encodedBodySize: processNavTimingValue("encodedBodySize"),
    fetchStart: processNavTimingValue("fetchStart", true),
    loadEventEnd: processNavTimingValue("loadEventEnd"),
    loadEventStart: processNavTimingValue("loadEventStart"),
    redirectCount: processNavTimingValue("redirectCount", true),
    redirectEnd: processNavTimingValue("redirectEnd"),
    redirectStart: processNavTimingValue("redirectStart"),
    requestStart: processNavTimingValue("requestStart"),
    responseEnd: processNavTimingValue("responseEnd"),
    responseStart: processNavTimingValue("responseStart"),
    secureConnectionStart: processNavTimingValue("secureConnectionStart"),
    transferSize: processNavTimingValue("transferSize"),
  };
}
