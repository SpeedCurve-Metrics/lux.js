/**
 * Extracts a single value from a LUX "timing string" (a string of continuous
 * <key><val> pairs where <key> is a string and <val> is numeric)
 */
exports.extractTimingValue = function (timingString, key) {
    return parseInt(timingString.match(new RegExp(`${key}(\\d+)`))[1], 10);
};
