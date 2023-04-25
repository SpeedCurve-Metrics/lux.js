import { timing } from "../performance";

/**
 * Get the number of milliseconds between navigationStart and the given PerformanceTiming key
 */
export function getNavTimingValue(key: keyof PerformanceTiming): number | undefined {
  if (typeof timing[key] === "number") {
    return Math.max(0, (timing[key] as number) - timing.navigationStart);
  }

  return undefined;
}
