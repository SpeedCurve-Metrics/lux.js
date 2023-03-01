import Matching from "./matching";

describe("Matching", () => {
  test("rules with a domain are matched correctly", () => {
    expect(Matching.isMatching("sub.domain.com/*", "sub.domain.com/")).toBe(true);
    expect(Matching.isMatching("sub.domain.com/*", "sub.domain.com/foo/bar")).toBe(true);
    expect(Matching.isMatching("sub.domain.com/foo", "sub.domain.com/foo")).toBe(true);
    expect(Matching.isMatching("sub.domain.com/foo", "sub.domain.com/foo")).toBe(true);

    expect(Matching.isMatching("sub.domain.com/*", "sub.sub.domain.com/foo/bar")).toBe(false);
    expect(Matching.isMatching("sub.domain.com/foo", "sub.domain.com/foo/bar")).toBe(false);
  });

  test("rules with a wildcard domain are matched correctly", () => {
    expect(Matching.isMatching("*.sub.domain.com/*", "sub.sub.domain.com/")).toBe(true);
    expect(Matching.isMatching("*.sub.domain.com/*", "foo.sub.domain.com/foo/bar")).toBe(true);
    expect(Matching.isMatching("*.sub.domain.com/foo", "foo.sub.domain.com/foo")).toBe(true);

    expect(Matching.isMatching("*.sub.domain.com/*", "sub.domain.com/")).toBe(false);
    expect(Matching.isMatching("*.sub.domain.com/foo", "sub.domain.com/foo")).toBe(false);
  });

  test("rules with only a path are matched correctly", () => {
    expect(Matching.isMatching("/", "domain.com/")).toBe(true);
    expect(Matching.isMatching("/foo/bar", "domain.com/foo/bar")).toBe(true);

    expect(Matching.isMatching("/", "domain.com/foo/bar")).toBe(false);
  });

  test("rules with only a wildcard path are matched correctly", () => {
    expect(Matching.isMatching("/*", "domain.com/")).toBe(true);
    expect(Matching.isMatching("/*", "domain.com/foo/bar")).toBe(true);
    expect(Matching.isMatching("/foo/*", "domain.com/foo/")).toBe(true);
    expect(Matching.isMatching("/foo/*", "domain.com/foo/bar")).toBe(true);

    expect(Matching.isMatching("/foo/*", "domain.com/foo")).toBe(false);
    expect(Matching.isMatching("/foo/*", "domain.com/foob/ar")).toBe(false);
  });
});
