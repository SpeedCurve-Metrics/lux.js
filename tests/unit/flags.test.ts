import { describe, expect, test } from "@jest/globals";
import Flags, { addFlag, hasFlag, removeFlag } from "../../src/flags";

describe("Flags", () => {
  test("adding & removing flags, and testing for flags", () => {
    let flags = 0;

    flags = addFlag(flags, Flags.VisibilityStateNotVisible);
    expect(hasFlag(flags, Flags.VisibilityStateNotVisible)).toBe(true);

    flags = addFlag(flags, Flags.PageLabelFromGlobalVariable);
    expect(hasFlag(flags, Flags.VisibilityStateNotVisible)).toBe(true);
    expect(hasFlag(flags, Flags.PageLabelFromGlobalVariable)).toBe(true);

    flags = removeFlag(flags, Flags.VisibilityStateNotVisible);
    expect(hasFlag(flags, Flags.VisibilityStateNotVisible)).toBe(false);
  });
});
