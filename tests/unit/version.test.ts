import { describe, expect, test } from "@jest/globals";
import { VERSION, versionAsFloat } from "../../src/version";

describe("Version", () => {
  test("VERSION is defined", () => {
    expect(VERSION).toBeDefined();
  });

  test("versionAsNumber()", () => {
    expect(versionAsFloat("4.0.1")).toEqual(4.0001);
    expect(versionAsFloat("4.0.10")).toEqual(4.001);
    expect(versionAsFloat("4.29.6")).toEqual(4.2906);
    expect(versionAsFloat("13.13.3")).toEqual(13.1303);
  });
});
