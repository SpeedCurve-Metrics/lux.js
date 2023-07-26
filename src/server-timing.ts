export type ServerTimingConfig = Record<string, ServerTimingMetricSpec>;
type ServerTimingMetricSpec = [ServerTimingType] | [ServerTimingType, DurationMetricMultiplier];
type ServerTimingType = typeof TYPE_DURATION | typeof TYPE_DESCRIPTION;

/**
 * A server timing metric that has its value set to the duration field
 */
export const TYPE_DURATION = "r";

/**
 * A server timing metric that has its value set to the description field
 */
export const TYPE_DESCRIPTION = "s";

/**
 * Duration metrics are stored in the lowest common unit, e.g. bytes for size metrics or milliseconds
 * for time metrics. Customers can send any unit in the duration field, so we need to multiply it
 * to convert it to the lowest common unit.
 */
type DurationMetricMultiplier = number;

/**
 * When a description metric has no value, we consider it to be a boolean and set it to this value.
 */
const BOOLEAN_TRUE_VALUE = "true";

export function getKeyValuePairs(
  config: ServerTimingConfig,
  serverTiming: readonly PerformanceServerTiming[],
): Record<string, string | number> {
  const pairs: Record<string, string | number> = {};

  serverTiming.forEach((stEntry) => {
    const name = stEntry.name;
    const description = stEntry.description;

    if (name in config) {
      const spec = config[name];
      const multiplier = spec[1];

      if (spec[0] === TYPE_DURATION) {
        pairs[name] = stEntry.duration * (multiplier || 1);
      } else if (description && multiplier) {
        const numericValue = parseFloat(description);

        if (!isNaN(numericValue)) {
          pairs[name] = numericValue * multiplier;
        }
      } else {
        pairs[name] = description || BOOLEAN_TRUE_VALUE;
      }
    }
  });

  return pairs;
}
