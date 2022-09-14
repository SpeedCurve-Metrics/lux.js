import Matching from "../../src/matching";

describe("Test hostname root matching", () => {
  test("Homepage no domain specified - /", () => {
    expect(Matching.isMatching("/", "speedcurve.com/")).toBe(true);
    expect(Matching.isMatching("/", "app.speedcurve.com/")).toBe(true);
    expect(Matching.isMatching("/", "www.app.speedcurve.com/")).toBe(true);
    expect(Matching.isMatching("/", "speedcurve.co.nz/")).toBe(true);
    expect(Matching.isMatching("/", "xn--c6h.com/")).toBe(true); // IDN domains

    expect(Matching.isMatching("/", "speedcurve.com")).toBe(false);
    expect(Matching.isMatching("/", "speedcurve.com/foo")).toBe(false);
  });

  test("Homepage with domain specified - foo.bar/", () => {
    expect(Matching.isMatching("speedcurve.com/", "speedcurve.com/")).toBe(true);

    expect(Matching.isMatching("speedcurve.com/", "google.com/")).toBe(false);
    expect(Matching.isMatching("speedcurve.com/", "app.speedcurve.com/")).toBe(false);
    expect(Matching.isMatching("speedcurve.com/", "www.app.speedcurve.com/")).toBe(false);
    expect(Matching.isMatching("speedcurve.com/", "speedcurve.co.nz/")).toBe(false);
    expect(Matching.isMatching("speedcurve.com/", "speedcurve.com")).toBe(false);
    expect(Matching.isMatching("speedcurve.com/", "speedcurve.com/foo")).toBe(false);
  });
});

describe("Test pathname with wilcard (*) matching", () => {
  test("Pattern with single wildcard - /foo*", () => {
    expect(Matching.isMatching("/foo*", "speedcurve.com/foo")).toBe(true);
    expect(Matching.isMatching("/foo*", "speedcurve.com/foobar")).toBe(true);
    expect(Matching.isMatching("/foo*", "speedcurve.com/foo/baz/")).toBe(true);
    expect(Matching.isMatching("/foo*", "speedcurve.com/foo/baz/bar/bing-bong/boop")).toBe(true);
    expect(Matching.isMatching("/foo*", "speedcurve.com/foo/foo")).toBe(true);

    expect(Matching.isMatching("/foo*", "speedcurve.com/bar/foo")).toBe(false);
    expect(Matching.isMatching("/foo*", "speedcurve.com/bar/foo/baz")).toBe(false);
    expect(Matching.isMatching("/foo*", "foo.com/")).toBe(false);
    expect(Matching.isMatching("/foo*", "foo.com/bar")).toBe(false);
    expect(Matching.isMatching("/foo*", "speedcurve.com/bar/")).toBe(false);
    expect(Matching.isMatching("/foo*", "speedcurve.com/boop/bing/bar/")).toBe(false);
  });

  test("Pattern with multiple wildcards - /foo/*/bar/*", () => {
    expect(Matching.isMatching("/foo/*/bar/*", "speedcurve.com/foo/baz/bar/")).toBe(true);
    expect(Matching.isMatching("/foo/*/bar/*", "speedcurve.com/foo/baz/bar/bing")).toBe(true);
    expect(Matching.isMatching("/foo/*/bar/*", "speedcurve.com/foo/baz/bear/bar/bing")).toBe(true);
    expect(Matching.isMatching("/foo/*/bar/*", "speedcurve.com/foo/baz/bar/bing-bong/boop")).toBe(
      true
    );

    expect(Matching.isMatching("/foo/*/bar/*", "speedcurve.com/foo/baz/bar")).toBe(false);
    expect(Matching.isMatching("/foo/*/bar/*", "speedcurve.com/foo/bar/")).toBe(false);
    expect(Matching.isMatching("/foo/*/bar/*", "speedcurve.com/boop/foo/bing/bar/")).toBe(false);
  });
});

describe("Test subdomain matching", () => {
  test("Subdomain pattern with single wildcard - *.speedcurve.com/", () => {
    expect(Matching.isMatching("*.speedcurve.com/", "app.speedcurve.com/")).toBe(true);
    expect(Matching.isMatching("*.speedcurve.com/", "www.speedcurve.com/")).toBe(true);
    expect(Matching.isMatching("*.speedcurve.com/", "two.levels.speedcurve.com/")).toBe(true);

    expect(Matching.isMatching("*.speedcurve.com/", "speedcurve.com/")).toBe(false);
    expect(Matching.isMatching("*.speedcurve.com/", "www.speedcurve.com/foo/")).toBe(false);
  });

  test("Subdomain pattern with multiple wildcards - *.speedcurve.com/*/bar", () => {
    expect(Matching.isMatching("*.speedcurve.com/*/bar", "app.speedcurve.com/foo/baz/bar")).toBe(
      true
    );
    expect(Matching.isMatching("*.speedcurve.com/*/bar", "speedcurve.com/foo/baz/bar")).toBe(false);
  });
});
