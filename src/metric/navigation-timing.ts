import { START_MARK } from "../constants";
import { getNavigationEntry } from "../performance";

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

export const KEYS: Record<keyof NavigationTimingData, string> = {
  activationStart: "activationStart",
  connectEnd: "connectEnd",
  connectStart: "connectStart",
  decodedBodySize: "decodedBodySize",
  domainLookupEnd: "domainLookupEnd",
  domainLookupStart: "domainLookupStart",
  domComplete: "domComplete",
  domContentLoadedEventEnd: "domContentLoadedEventEnd",
  domContentLoadedEventStart: "domContentLoadedEventStart",
  domInteractive: "domInteractive",
  encodedBodySize: "encodedBodySize",
  fetchStart: "fetchStart",
  loadEventEnd: "loadEventEnd",
  loadEventStart: "loadEventStart",
  redirectCount: "redirectCount",
  redirectEnd: "redirectEnd",
  redirectStart: "redirectStart",
  requestStart: "requestStart",
  responseEnd: "responseEnd",
  responseStart: "responseStart",
  secureConnectionStart: "secureConnectionStart",
  transferSize: "transferSize",
};

export function processEntry(entry: PerformanceNavigationTiming): void {
  currentNavigation = entry;
  console.log({ currentNavigation });
}

export function getData(): NavigationTimingData | undefined {
  const startMark = performance.getEntriesByName(START_MARK).pop();

  if (startMark) {
    // Don't report navigation timing in SPA beacons
    return undefined;
  }

  const fallback = getNavigationEntry();
  const entry: Partial<NavigationTimingData> = {};

  for (const key in KEYS) {
    entry[key as keyof NavigationTimingData] = currentNavigation
      ? currentNavigation[key as keyof NavigationTimingData]
      : fallback[key as keyof NavigationTimingData];
  }

  return entry as NavigationTimingData;
}
