import { describe, expect, test } from "@jest/globals";
import * as String from "../../src/string";

describe("String", () => {
  test("padStart()", () => {
    expect(String.padStart("1", 3, "0")).toEqual("001");
    expect(String.padStart("12", 3, "0")).toEqual("012");
    expect(String.padStart("123", 3, "0")).toEqual("123");
    expect(String.padStart("1234", 3, "0")).toEqual("1234");
    expect(String.padStart("", 3, "0")).toEqual("000");
    expect(String.padStart("", 1, "0")).toEqual("0");
    expect(String.padStart("", 0, "0")).toEqual("");

    // Make sure it doesn't modify the original value
    const str = "123";
    String.padStart(str, 5, "0");
    expect(str).toEqual("123");
  });
});
