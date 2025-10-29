import { START_MARK } from "../constants";
import { getNavigationEntry } from "../performance";

let currentNavigation: PerformanceNavigationTiming;

export type NavigationTimingData = {
  activationStart: number;
  connectEnd: number;
  connectStart: number;
  decodedBodySize: number;
  domainLookupEnd: number;
  domainLookupStart: number;
  domComplete: number;
  domContentLoadedEventEnd: number;
  domContentLoadedEventStart: number;
  domInteractive: number;
  encodedBodySize: number;
  fetchStart: number;
  loadEventEnd: number;
  loadEventStart: number;
  redirectCount: number;
  redirectEnd: number;
  redirectStart: number;
  requestStart: number;
  responseEnd: number;
  responseStart: number;
  secureConnectionStart: number;
  transferSize: number;
};

type NavigationTimingRef = `_${keyof NavigationTimingData}`;

export const KEYS: Record<NavigationTimingRef, keyof NavigationTimingData> = {
  _activationStart: "activationStart",
  _connectEnd: "connectEnd",
  _connectStart: "connectStart",
  _decodedBodySize: "decodedBodySize",
  _domainLookupEnd: "domainLookupEnd",
  _domainLookupStart: "domainLookupStart",
  _domComplete: "domComplete",
  _domContentLoadedEventEnd: "domContentLoadedEventEnd",
  _domContentLoadedEventStart: "domContentLoadedEventStart",
  _domInteractive: "domInteractive",
  _encodedBodySize: "encodedBodySize",
  _fetchStart: "fetchStart",
  _loadEventEnd: "loadEventEnd",
  _loadEventStart: "loadEventStart",
  _redirectCount: "redirectCount",
  _redirectEnd: "redirectEnd",
  _redirectStart: "redirectStart",
  _requestStart: "requestStart",
  _responseEnd: "responseEnd",
  _responseStart: "responseStart",
  _secureConnectionStart: "secureConnectionStart",
  _transferSize: "transferSize",
};

export function processEntry(entry: PerformanceNavigationTiming): void {
  currentNavigation = entry;
}

export function getData(): NavigationTimingData | undefined {
  const startMark = performance.getEntriesByName(START_MARK).pop();

  if (startMark) {
    // Don't report navigation timing in SPA beacons
    return undefined;
  }

  const fallback = getNavigationEntry();
  const entry: Partial<NavigationTimingData> = {};

  for (const k in KEYS) {
    const key = KEYS[k as NavigationTimingRef];

    entry[key as keyof NavigationTimingData] = currentNavigation
      ? currentNavigation[key as keyof NavigationTimingData]
      : fallback[key as keyof NavigationTimingData];
  }

  return entry as NavigationTimingData;
}
