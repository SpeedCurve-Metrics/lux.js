import * as Flags from "../../src/flags";
import { LogEvent, LogEventRecord } from "../../src/logger";

export function getCpuStat(beacon: URL, key: string): number | null {
  const cpu = parseNestedPairs(beacon.searchParams.get("CPU"));

  return parseInt(cpu[key]);
}

export function getLuxJsStat(beacon: URL, key: string): number | null {
  return extractCondensedValue(beacon.searchParams.get("LJS"), key);
}

export function getPageStat(beacon: URL, key: string): number | null {
  return extractCondensedValue(beacon.searchParams.get("PS"), key);
}

export function getNavTiming(beacon: URL, key: string): number | null {
  return extractCondensedValue(beacon.searchParams.get("NT"), key);
}

export function hasFlag(beacon: URL, flag: number): boolean {
  const beaconFlags = parseInt(beacon.searchParams.get("fl"));

  return Flags.hasFlag(beaconFlags, flag);
}

/**
 * Extracts a single value from a LUX "condensed string" (a string of continuous
 * <key><val> pairs where <key> is a string and <val> is numeric)
 */
export function extractCondensedValue(timingString: string, key: string): number | null {
  const matches = timingString.match(new RegExp(`${key}(\\d+)`));

  return matches ? parseInt(matches[1]) : null;
}

/**
 * Extracts values from a "nested pair" string (a comma-separated string of
 * <key>|<val> pairs)
 */
export function parseNestedPairs(nestedPairString: string): Record<string, string> {
  return Object.fromEntries(
    nestedPairString.split(",").map((pair) => {
      const parts = pair.split("|");

      return [parts[0], parts[1]];
    })
  );
}

/**
 * Gets a performance.timing value as milliseconds since navigation start
 */
export async function getPerformanceTimingMs(page, metric) {
  const navigationStart = await page.evaluate("performance.timing.navigationStart");
  const timingValue = await page.evaluate(`performance.timing.${metric}`);

  return timingValue - navigationStart;
}

/**
 * Gets the current time as milliseconds since navigation start
 */
export async function getElapsedMs(page) {
  return await page.evaluate("Math.round(performance.now())");
}

type DecodedLogEventRecord = [Date, string, ...unknown[]];

const logEventLookup = Object.fromEntries(Object.entries(LogEvent).map((arr) => arr.reverse()));

export function decodeEventLog(eventLog: LogEventRecord[]): DecodedLogEventRecord[] {
  return eventLog.map(([date, eventId, ...args]) => [date, logEventLookup[eventId], ...args]);
}
