import { clamp, floor } from "../math";
import { getNavigationEntry } from "../performance";

/**
 * Get the number of milliseconds between navigationStart and the given PerformanceNavigationTiming key
 */
export function getNavTimingValue(
  key: keyof PerformanceNavigationTiming,
  relativeTo: number
): number | undefined {
  const navEntry = getNavigationEntry();

  if (typeof navEntry[key] === "number") {
    return clamp(floor((navEntry[key] as number) - relativeTo));
  }

  return undefined;
}
