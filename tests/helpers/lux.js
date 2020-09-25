/**
 * Extracts a single value from a LUX "timing string" (a string of continuous
 * <key><val> pairs where <key> is a string and <val> is numeric)
 */
exports.extractTimingValue = function (timingString, key) {
  return parseInt(timingString.match(new RegExp(`${key}(\\d+)`))[1], 10);
};

/**
 * Extracts CPU metrics from a LUX "CPU string" (a comma-separated string of
 * <key>|<val> pairs)
 */
exports.extractCpuMetrics = function (cpuMetrics) {
  return Object.fromEntries(
    cpuMetrics.split(",").map((pair) => {
      const parts = pair.split("|");

      return [parts[0], parseInt(parts[1], 10)];
    })
  );
};
