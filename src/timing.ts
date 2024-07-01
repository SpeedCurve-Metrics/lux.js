import { START_MARK } from "./constants";
import { clamp, floor, max } from "./math";
import now from "./now";
import { getEntriesByName, getNavigationEntry, performance, timing } from "./performance";

/**
 * Milliseconds since navigationStart representing when the page was restored from the bfcache
 */
let pageRestoreTime: number | undefined;

export function setPageRestoreTime(time: number): void {
  pageRestoreTime = time;
}

export function getPageRestoreTime(): number | undefined {
  return pageRestoreTime;
}

/**
 * To measure the way a user experienced a metric, we measure metrics relative to the time the user
 * started viewing the page. On prerendered pages, this is activationStart. On bfcache restores, this
 * is the page restore time. On all other pages this value will be zero.
 */
export function getZeroTime() {
  return max(
    getPageRestoreTime() || 0,
    getNavigationEntry().activationStart,
    getEntriesByName(START_MARK).pop()?.startTime || 0,
  );
}

/**
 * Most time-based metrics that LUX reports should be relative to the "zero" marker, rounded down
 * to the nearest unit so as not to report times in the future, and clamped to zero.
 */
export function processTimeMetric(value: number) {
  return clamp(floor(value - getZeroTime()));
}

/**
 * Returns the number of milliseconds since navigationStart.
 */
export function msSinceNavigationStart(): number {
  if (performance.now) {
    return floor(performance.now());
  }

  return now() - timing.navigationStart;
}

/**
 * Returns the number of milliseconds since the current page was initialized. For SPAs, this is the
 * time since the last LUX.init() call.
 */
export function msSincePageInit(): number {
  const sinceNavigationStart = msSinceNavigationStart();
  const startMark = getEntriesByName(START_MARK).pop();

  if (startMark) {
    return floor(sinceNavigationStart - startMark.startTime);
  }

  return sinceNavigationStart;
}
