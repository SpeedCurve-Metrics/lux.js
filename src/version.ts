import pkg from "../package.json" with { type: "json" };

const { version: pkgVersion, config: pkgConfig } = pkg;
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
