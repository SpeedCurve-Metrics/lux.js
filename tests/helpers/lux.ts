import * as Flags from "../../src/flags";

export function getCpuStat(beacon: URL, key: string): number | null {
  const cpu = parseNestedPairs(getSearchParam(beacon, "CPU"));

  return parseInt(cpu[key]);
}

export function getLuxJsStat(beacon: URL, key: string): number | null {
  return extractCondensedValue(getSearchParam(beacon, "LJS"), key);
}

export function getPageStat(beacon: URL, key: string): number | null {
  return extractCondensedValue(getSearchParam(beacon, "PS"), key);
}

export function getNavTiming(beacon: URL, key: string): number | null {
  return extractCondensedValue(getSearchParam(beacon, "NT"), key);
}

export function hasFlag(beacon: URL, flag: number): boolean {
  const beaconFlags = parseInt(getSearchParam(beacon, "fl"));

  return Flags.hasFlag(beaconFlags, flag);
}

export function getSearchParam(url: URL, param: string): string {
  return url.searchParams.get(param) || "";
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

      return [parts[0], parts.slice(1).join("|")];
    })
  );
}

interface UserTimingItem {
  startTime: number;
  duration?: number;
}

export function parseUserTiming(userTimingString: string): Record<string, UserTimingItem> {
  const pairs = parseNestedPairs(userTimingString);
  const userTiming = {};

  for (const [key, value] of Object.entries(pairs)) {
    if (value.indexOf("|") > -1) {
      const parts = value.split("|");

      userTiming[key] = {
        startTime: parseInt(parts[0]),
        duration: parseInt(parts[1]),
      };
    } else {
      userTiming[key] = {
        startTime: parseInt(value),
      };
    }
  }

  return userTiming;
}

/**
 * Gets a performance.timing value as milliseconds since navigation start
 */
export async function getPerformanceTimingMs(page, metric): Promise<number> {
  return page.evaluate(
    (metric) => performance.timing[metric] - performance.timing.navigationStart,
    metric
  );
}

/**
 * Gets the current time as milliseconds since navigation start
 */
export async function getElapsedMs(page): Promise<number> {
  return await page.evaluate(() => Math.floor(performance.now()));
}
