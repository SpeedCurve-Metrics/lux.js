/**
 * Extracts a single value from a LUX "condensed string" (a string of continuous
 * <key><val> pairs where <key> is a string and <val> is numeric)
 *
 * @returns Number|null
 */
exports.extractCondensedValue = function (timingString, key) {
  const matches = timingString.match(new RegExp(`${key}(\\d+)`));

  return matches ? parseInt(matches[1], 10) : null;
};

/**
 * Extracts values from a "nested pair" string (a comma-separated string of
 * <key>|<val> pairs)
 */
exports.parseNestedPairs = function (cpuMetrics) {
  return Object.fromEntries(
    cpuMetrics.split(",").map((pair) => {
      const parts = pair.split("|");

      return [parts[0], parts[1]];
    })
  );
};

/**
 * Gets a performance.timing value as milliseconds since navigation start
 */
exports.getPerformanceTimingMs = async function (page, metric) {
  const navigationStart = await page.evaluate("performance.timing.navigationStart");
  const timingValue = await page.evaluate(`performance.timing.${metric}`);

  return timingValue - navigationStart;
};

/**
 * Gets the current time as milliseconds since navigation start
 */
exports.getElapsedMs = async function (page) {
  return await page.evaluate("Math.round(performance.now())");
};
