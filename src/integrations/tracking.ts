const KNOWN_TRACKING_PARAMS = [
  "utm_source",
  "utm_campaign",
  "utm_medium",
  "utm_term",
  "utm_content",
];

/**
 * Add known tracking parameters to the custom data storage.
 */
export function getTrackingParams(): Record<string, string> {
  const trackingParams: Record<string, string> = {};

  if (location.search && URLSearchParams) {
    const p = new URLSearchParams(location.search);

    for (const key of KNOWN_TRACKING_PARAMS) {
      const value = p.get(key);
      if (value) {
        trackingParams[key] = value;
      }
    }
  }

  return trackingParams;
}
