import { Page } from "@playwright/test";
import * as Flags from "../../src/flags";

const navigationTimingKeys = {
  as: "activationStart",
  rs: "redirectStart",
  re: "redirectEnd",
  fs: "fetchStart",
  ds: "domainLookupStart",
  de: "domainLookupEnd",
  cs: "connectStart",
  sc: "secureConnectionStart",
  ce: "connectEnd",
  qs: "requestStart",
  bs: "responseStart",
  be: "responseEnd",
  oi: "domInteractive",
  os: "domContentLoadedEventStart",
  oe: "domContentLoadedEventEnd",
  oc: "domComplete",
  ls: "loadEventStart",
  le: "loadEventEnd",
  sr: "startRender",
  fc: "firstContentfulPaint",
  lc: "largestContentfulPaint",
} as const;

export function getCpuStat(beacon: URL, key: string): number | null {
  const cpu = parseNestedPairs(getSearchParam(beacon, "CPU"));

  return parseFloat(cpu[key]);
}

export function getLuxJsStat(beacon: URL, key: string): number | null {
  return extractCondensedValue(getSearchParam(beacon, "LJS"), key);
}

export function getPageStat(beacon: URL, key: string): number | null {
  return extractCondensedValue(getSearchParam(beacon, "PS"), key);
}

type NavigationTimingKey = (typeof navigationTimingKeys)[keyof typeof navigationTimingKeys];

export function getNavTiming(beacon: URL, key: string): number | null;
export function getNavTiming(beacon: URL): Record<NavigationTimingKey, number>;
export function getNavTiming(
  beacon: URL,
  key?: string,
): number | null | Record<NavigationTimingKey, number> {
  if (key) {
    return extractCondensedValue(getSearchParam(beacon, "NT"), key);
  }

  const matches = getSearchParam(beacon, "NT").match(/[a-z]+[0-9]+/g);

  if (!matches) {
    return {} as Record<NavigationTimingKey, number>;
  }

  return Object.fromEntries(
    matches.map((str) => {
      const key = str.match(/[a-z]+/)![0];
      const name = navigationTimingKeys[key as keyof typeof navigationTimingKeys];
      const val = parseFloat(str.match(/\d+/)![0]);

      return [name, val];
    }),
  ) as Record<NavigationTimingKey, number>;
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

  return matches ? parseFloat(matches[1]) : null;
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
    }),
  );
}

interface UserTimingItem {
  startTime: number;
  duration?: number;
}

export function parseUserTiming(userTimingString: string): Record<string, UserTimingItem> {
  const pairs = parseNestedPairs(userTimingString);
  const userTiming: Record<string, UserTimingItem> = {};

  for (const [key, value] of Object.entries(pairs)) {
    if (value.indexOf("|") > -1) {
      const parts = value.split("|");

      userTiming[key] = {
        startTime: parseFloat(parts[0]),
        duration: parseFloat(parts[1]),
      };
    } else {
      userTiming[key] = {
        startTime: parseFloat(value),
      };
    }
  }

  return userTiming;
}

/**
 * Gets a performance.timing value as milliseconds since navigation start
 */
export async function getNavigationTimingMs(page: Page, metric: string): Promise<number> {
  return page.evaluate(
    // @ts-expect-error No need for complex types here
    (metric) => Math.floor(performance.getEntriesByType("navigation")[0][metric]),
    metric,
  );
}

/**
 * Gets the current time as milliseconds since navigation start
 */
export async function getElapsedMs(page: Page): Promise<number> {
  return await page.evaluate(() => Math.floor(performance.now()));
}
