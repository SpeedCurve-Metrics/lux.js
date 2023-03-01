export function patternMatchesUrl(pattern: string, hostname: string, pathname: string): boolean {
  const regex = createRegExpFromPattern(pattern);

  if (pattern.slice(0, 1) === "/") {
    // Rule is a pathname only
    return regex.test(pathname);
  }

  // Rule is a hostname and pathname
  return regex.test(hostname + pathname);
}

function createRegExpFromPattern(pattern: string): RegExp {
  return new RegExp("^" + pattern.replaceAll("*", ".*") + "$", "i");
}
