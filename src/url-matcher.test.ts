import { patternMatchesUrl } from "./url-matcher";

describe("URL matcher", () => {
  describe("patternMatchesUrl()", () => {
    test("patterns with a domain are matched correctly", () => {
      expect(patternMatchesUrl("sub.domain.com/*", "sub.domain.com", "/")).toBe(true);
      expect(patternMatchesUrl("sub.domain.com/*", "sub.domain.com", "/foo/bar")).toBe(true);
      expect(patternMatchesUrl("sub.domain.com/foo", "sub.domain.com", "/foo")).toBe(true);
      expect(patternMatchesUrl("sub.domain.com/foo", "sub.domain.com", "/foo")).toBe(true);

      expect(patternMatchesUrl("sub.domain.com/*", "sub.sub.domain.com", "/foo/bar")).toBe(false);
      expect(patternMatchesUrl("sub.domain.com/foo", "sub.domain.com", "/foo/bar")).toBe(false);
    });

    test("patterns with a wildcard domain are matched correctly", () => {
      expect(patternMatchesUrl("*.sub.domain.com/*", "sub.sub.domain.com", "/")).toBe(true);
      expect(patternMatchesUrl("*.sub.domain.com/*", "foo.sub.domain.com", "/foo/bar")).toBe(true);
      expect(patternMatchesUrl("*.sub.domain.com/foo", "foo.sub.domain.com", "/foo")).toBe(true);

      expect(patternMatchesUrl("*.sub.domain.com/*", "sub.domain.com", "/")).toBe(false);
      expect(patternMatchesUrl("*.sub.domain.com/foo", "sub.domain.com", "/foo")).toBe(false);
    });

    test("patterns with only a path are matched correctly", () => {
      expect(patternMatchesUrl("/", "domain.com", "/")).toBe(true);
      expect(patternMatchesUrl("/foo/bar", "domain.com", "/foo/bar")).toBe(true);

      expect(patternMatchesUrl("/", "domain.com", "/foo/bar")).toBe(false);
    });

    test("patterns with only a wildcard path are matched correctly", () => {
      expect(patternMatchesUrl("/*", "domain.com", "/")).toBe(true);
      expect(patternMatchesUrl("/*", "domain.com", "/foo/bar")).toBe(true);
      expect(patternMatchesUrl("/foo/*", "domain.com", "/foo/")).toBe(true);
      expect(patternMatchesUrl("/foo/*", "domain.com", "/foo/bar")).toBe(true);

      expect(patternMatchesUrl("/foo/*", "domain.com", "/foo")).toBe(false);
      expect(patternMatchesUrl("/foo/*", "domain.com", "/foob/ar")).toBe(false);
    });

    test("patterns with special characters are matched correctly", () => {
      expect(patternMatchesUrl("my-domain.com/q+a/*", "my-domain.com", "/q+a/foo")).toBe(true);
      expect(patternMatchesUrl("domain.com/js/{*}", "domain.com", '/js/{"foo":"bar"}')).toBe(true);
    });
  });
});
