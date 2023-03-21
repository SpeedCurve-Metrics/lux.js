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
  return new RegExp("^" + escapeStringForRegExp(pattern).replaceAll("*", ".*") + "$", "i");
}

function escapeStringForRegExp(str: string): string {
  // Note: we don't escape * because it's our own special symbol!
  return str.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
}
