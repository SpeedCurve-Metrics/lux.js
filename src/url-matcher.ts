export interface UrlPatternMapping {
  [key: string]: string[];
}

export function getMatchesFromPatternMap(
  patternMap: UrlPatternMapping,
  hostname: string,
  pathname: string
): string[];
export function getMatchesFromPatternMap(
  patternMap: UrlPatternMapping,
  hostname: string,
  pathname: string,
  firstOnly: boolean
): string | undefined;
export function getMatchesFromPatternMap(
  patternMap: UrlPatternMapping,
  hostname: string,
  pathname: string,
  firstOnly?: boolean
): string[] | (string | undefined) {
  const matches = [];

  for (const key in patternMap) {
    const patterns = patternMap[key];
    if (Array.isArray(patterns)) {
      for (const i in patterns) {
        const pattern = patterns[i];

        if (patternMatchesUrl(pattern, hostname, pathname)) {
          if (firstOnly) {
            return key;
          }

          matches.push(key);
        }
      }
    }
  }

  if (firstOnly) {
    return undefined;
  }

  return matches;
}

export function patternMatchesUrl(pattern: string, hostname: string, pathname: string): boolean {
  const regex = createRegExpFromPattern(pattern);

  if (pattern.charAt(0) === "/") {
    // Rule is a pathname only
    return regex.test(pathname);
  }

  // Rule is a hostname and pathname
  return regex.test(hostname + pathname);
}

function createRegExpFromPattern(pattern: string): RegExp {
  return new RegExp("^" + escapeStringForRegExp(pattern).replace(/\*/g, ".*") + "$", "i");
}

function escapeStringForRegExp(str: string): string {
  // Note: we don't escape * because it's our own special symbol!
  return str.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
}
