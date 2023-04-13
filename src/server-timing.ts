export type ServerTimingConfig = Record<string, ServerTimingType>;

type ServerTimingType = typeof TYPE_DURATION | typeof TYPE_DESCRIPTION;

/**
 * A server timing metric that has its value set to the duration field
 */
export const TYPE_DURATION = "r";

/**
 * A server timing metric that has its value set to the description field
 */
export const TYPE_DESCRIPTION = "s";

const BOOLEAN_TRUE_VALUE = "true";

export function getKeyValuePairs(
  config: ServerTimingConfig,
  serverTiming: readonly PerformanceServerTiming[]
): Record<string, string | number> {
  const pairs: Record<string, string | number> = {};

  serverTiming.forEach((stEntry) => {
    const name = stEntry.name;

    if (name in config) {
      if (config[name] === TYPE_DURATION) {
        pairs[name] = stEntry.duration;
      } else {
        pairs[name] = stEntry.description || BOOLEAN_TRUE_VALUE;
      }
    }
  });

  return pairs;
}
