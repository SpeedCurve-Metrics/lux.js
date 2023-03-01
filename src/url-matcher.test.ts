import { patternMatchesUrl } from "./url-matcher";

describe("Matching", () => {
  test("rules with a domain are matched correctly", () => {
    expect(patternMatchesUrl("sub.domain.com/*", "sub.domain.com", "/")).toBe(true);
    expect(patternMatchesUrl("sub.domain.com/*", "sub.domain.com", "/foo/bar")).toBe(true);
    expect(patternMatchesUrl("sub.domain.com/foo", "sub.domain.com", "/foo")).toBe(true);
    expect(patternMatchesUrl("sub.domain.com/foo", "sub.domain.com", "/foo")).toBe(true);

    expect(patternMatchesUrl("sub.domain.com/*", "sub.sub.domain.com", "/foo/bar")).toBe(false);
    expect(patternMatchesUrl("sub.domain.com/foo", "sub.domain.com", "/foo/bar")).toBe(false);
  });

  test("rules with a wildcard domain are matched correctly", () => {
    expect(patternMatchesUrl("*.sub.domain.com/*", "sub.sub.domain.com", "/")).toBe(true);
    expect(patternMatchesUrl("*.sub.domain.com/*", "foo.sub.domain.com", "/foo/bar")).toBe(true);
    expect(patternMatchesUrl("*.sub.domain.com/foo", "foo.sub.domain.com", "/foo")).toBe(true);

    expect(patternMatchesUrl("*.sub.domain.com/*", "sub.domain.com", "/")).toBe(false);
    expect(patternMatchesUrl("*.sub.domain.com/foo", "sub.domain.com", "/foo")).toBe(false);
  });

  test("rules with only a path are matched correctly", () => {
    expect(patternMatchesUrl("/", "domain.com", "/")).toBe(true);
    expect(patternMatchesUrl("/foo/bar", "domain.com", "/foo/bar")).toBe(true);

    expect(patternMatchesUrl("/", "domain.com", "/foo/bar")).toBe(false);
  });

  test("rules with only a wildcard path are matched correctly", () => {
    expect(patternMatchesUrl("/*", "domain.com", "/")).toBe(true);
    expect(patternMatchesUrl("/*", "domain.com", "/foo/bar")).toBe(true);
    expect(patternMatchesUrl("/foo/*", "domain.com", "/foo/")).toBe(true);
    expect(patternMatchesUrl("/foo/*", "domain.com", "/foo/bar")).toBe(true);

    expect(patternMatchesUrl("/foo/*", "domain.com", "/foo")).toBe(false);
    expect(patternMatchesUrl("/foo/*", "domain.com", "/foob/ar")).toBe(false);
  });
});
