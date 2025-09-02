import { version as pkgVersion, config as pkgConfig } from "../package.json";
import { padStart } from "./string";

export const VERSION = pkgVersion;
export const SNIPPET_VERSION = pkgConfig.snippetVersion;

/**
 * Returns the version of the script as a float to be stored in legacy systems that do not support
 * string versions.
 */
export function versionAsFloat(ver = VERSION): number {
  const parts = ver.split(".");

  return parseFloat(parts[0] + "." + padStart(parts[1], 2, "0") + padStart(parts[2], 2, "0"));
}
