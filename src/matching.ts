export default class Matching {
  static wildcard = "*";
  static domainExpression = "[a-zA-Z0-9-.]{1,61}[a-zA-Z0-9]\\.[a-zA-Z]{2,}";

  static isMatching(pattern: string, url: string): boolean {
    const regexp = Matching.createRegexpFromPattern(pattern);
    console.log(pattern, url, regexp, url.match(regexp) ? true : false);
    return url.match(regexp) ? true : false;
  }

  /**
   * Converts string pattern to RegExp object
   * @return RegExp
   */
  static createRegexpFromPattern(pattern: string): RegExp {
    let regexp;
    if (pattern == "/") {
      regexp = this.getRegexpForHostnameRoot();
    } else if (!pattern.includes(Matching.wildcard)) {
      regexp = this.getRegexpForExactString(pattern);
    } else {
      regexp = this.createRegexpFromPathname(pattern);
    }

    return regexp;
  }

  /**
   * Converts URL pathname string pattern to RegExp object
   * Multile wildcards (*) are supported
   * @return RegExp
   */
  static createRegexpFromPathname(pattern: string): RegExp {
    const anyDomain:boolean = pattern.charAt(0) == "/";
    pattern = this.escapeStringForRegexp(pattern);
    const expression =
      "^" +
      (anyDomain ? Matching.domainExpression : "") +
      pattern.replaceAll(Matching.wildcard, ".*?") +
      "$";
    return new RegExp(expression, "i");
  }

  /**
   * Matches hostname root (e.g. "/", "somedomain.com/", "www.somedomain.co.nz/")
   * Trailing slash is mandatory
   * @return RegExp
   */
  static getRegexpForHostnameRoot(): RegExp {
    return new RegExp("^" + Matching.domainExpression + "/$", "i");
  }

  /**
   * Matches exact string (no wildcard provided)
   * @return RegExp
   */
  static getRegexpForExactString(string: string): RegExp {
    const anyDomain:boolean = string.charAt(0) == "/";
    return new RegExp("^" + (anyDomain ? Matching.domainExpression : "") + this.escapeStringForRegexp(string) + "/?$", "i");
  }

  /**
   * Escape special symbols in regexp string
   * @param string
   */
  static escapeStringForRegexp(string: string): string {
    // we don't escape * because it's our own special symbol!
    return string.replace(/[-/\\^$+?.()|[\]{}]/g, "\\$&");
  }
}
