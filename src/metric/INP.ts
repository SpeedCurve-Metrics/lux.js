/**
 * This implementation is based on the web-vitals implementation, however it is stripped back to the
 * bare minimum required to measure just the INP value and does not store the actual event entries.
 */

// The maximum number of interactions to store
const MAX_INTERACTIONS = 10;

// A map of interactionId => latency for the slowest interactions
let interactionDurations: number[] = [];

// The total number of interactions recorded on the page
let interactionCount = 0;

export function reset(): void {
  interactionCount = 0;
  interactionDurations = [];
}

export function addEntry(entry: PerformanceEventTiming): void {
  interactionCount++;
  interactionDurations.push(entry.duration);

  // Only store the longest <MAX_INTERACTIONS> interactions
  interactionDurations = interactionDurations.sort((a, b) => b - a).slice(0, MAX_INTERACTIONS);
}

/**
 * Returns an estimated high percentile INP value based on the total number of interactions on the
 * current page.
 */
export function getHighPercentileINP(): number | undefined {
  return interactionDurations[
    Math.min(interactionDurations.length - 1, Math.floor(interactionCount / 50))
  ];
}
