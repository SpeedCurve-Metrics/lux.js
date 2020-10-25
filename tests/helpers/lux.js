/**
 * Extracts a single value from a LUX "condensed string" (a string of continuous
 * <key><val> pairs where <key> is a string and <val> is numeric)
 */
exports.extractCondensedValue = function (timingString, key) {
  return parseInt(timingString.match(new RegExp(`${key}(\\d+)`))[1], 10);
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
 * Gets loadEventStart as milliseconds from a page instance
 */
exports.getLoadEventStartMs = async function (page) {
  const navigationStart = await page.evaluate("performance.timing.navigationStart");
  const loadEventStart = await page.evaluate("performance.timing.loadEventStart");

  return loadEventStart - navigationStart;
};

/**
 * Gets the elapsed time since navigation start in milliseconds
 */
exports.getElapsedMs = async function (page) {
  const navigationStart = await page.evaluate("performance.timing.navigationStart");
  const now = await page.evaluate("Date.now()");

  return now - navigationStart;
};
