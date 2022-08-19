import Flags, { addFlag, hasFlag, removeFlag } from "./flags";

describe("Flags", () => {
  test("every flag is unique", () => {
    const flagValues = Object.values(Flags);
    const uniqueValues = new Set(flagValues);

    expect(uniqueValues.size).toEqual(flagValues.length);
  });

  test("flags use all available bits", () => {
    const flagValues = Object.values(Flags);

    expect(flagValues[0]).toBe(1);

    for (let i = 1; i < flagValues.length; i++) {
      expect(flagValues[i]).toBe(Math.pow(2, i));
    }
  });

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
