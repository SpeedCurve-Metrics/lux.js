import { ConfigObject } from "./config";

/**
 * Fit an array of user timing delimited strings into a URL and return both the entries that fit and
 * the remaining entries that didn't fit.
 */
export function fitUserTimingEntries(utValues: string[], config: ConfigObject, url: string) {
  // Start with the maximum allowed UT entries per beacon
  const beaconUtValues = utValues.slice(0, config.maxBeaconUTEntries);
  const remainingUtValues = utValues.slice(config.maxBeaconUTEntries);

  // Trim UT entries until they fit within the maximum URL length, ensuring at least one UT entry
  // is included.
  while (
    (url + "&UT=" + beaconUtValues.join(",")).length > config.maxBeaconUrlLength &&
    beaconUtValues.length > 1
  ) {
    remainingUtValues.unshift(beaconUtValues.pop()!);
  }

  return [beaconUtValues, remainingUtValues];
}
