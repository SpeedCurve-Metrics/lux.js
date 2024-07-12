import { padStart } from "./string";

export const VERSION = "4.0.23";

/**
 * Returns the version of the script as a float to be stored in legacy systems that do not support
 * string versions.
 */
export function versionAsFloat(ver = VERSION): number {
  const parts = ver.split(".");

  return parseFloat(parts[0] + "." + padStart(parts[1], 2, "0") + padStart(parts[2], 2, "0"));
}
