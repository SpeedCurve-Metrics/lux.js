import { floor } from "../math";
import { getNavigationEntry } from "../performance";

/**
 * Get the number of milliseconds between navigationStart and the given PerformanceNavigationTiming key
 */
export function getNavTimingValue(key: keyof PerformanceNavigationTiming): number | undefined {
  const navEntry = getNavigationEntry();
  const relativeTo = key === "activationStart" ? 0 : navEntry.activationStart;

  if (typeof navEntry[key] === "number") {
    return Math.max(0, floor((navEntry[key] as number) - relativeTo));
  }

  return undefined;
}
