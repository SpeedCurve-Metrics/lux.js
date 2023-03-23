import * as INP from "./INP";

describe("INP", () => {
  beforeEach(() => {
    INP.reset();
  });

  test("INP is calculated correctly for small sets of interactions", () => {
    INP.addEntry(makeEntry(1, 100));
    INP.addEntry(makeEntry(2, 200));
    INP.addEntry(makeEntry(3, 300));

    expect(INP.getHighPercentileINP()).toEqual(300);
  });

  test("INP is calculated correctly for small sets of interactions with duplicate IDs", () => {
    INP.addEntry(makeEntry(1, 100));
    INP.addEntry(makeEntry(1, 110));
    INP.addEntry(makeEntry(2, 200));
    INP.addEntry(makeEntry(3, 300));
    INP.addEntry(makeEntry(3, 290));
    INP.addEntry(makeEntry(3, 290));
    INP.addEntry(makeEntry(4, 220));
    INP.addEntry(makeEntry(4, 200));

    expect(INP.getHighPercentileINP()).toEqual(300);
  });

  test("INP is calculated correctly for large sets of interactions", () => {
    // This is generating 200 interactions, each with a duration equal to their index.
    for (let i = 0; i < 200; i++) {
      INP.addEntry(makeEntry(i, i + 1));
    }

    // The high percentile index is calculated as (N_INTERACTIONS / 50), which will be 4 for 200
    // interactions. Since we store the slowest 10 interactions in reverse order, the 4th slowest
    // should be the 196th interaction, with a duration of 196.
    expect(INP.getHighPercentileINP()).toEqual(196);
  });

  test("INP is calculated correctly for large sets of interactions with duplicate IDs", () => {
    // This generates 200 entries, each of which uses `(index % 2) + 2` as both the interaction ID
    // and the duration. We expect events with duplicate IDs to be merged together, so in reality
    for (let i = 0; i < 200; i++) {
      INP.addEntry(makeEntry(i, i + 1));
    }

    // The high percentile index is calculated as (N_INTERACTIONS / 50), which will be 4 for 200
    // interactions. Since we store the slowest 10 interactions in reverse order, the 4th slowest
    // should be the 196th interaction, with a duration of 196.
    expect(INP.getHighPercentileINP()).toEqual(196);
  });
});

function makeEntry(interactionId: number, duration: number): PerformanceEventTiming {
  return {
    interactionId,
    duration,
    entryType: "event",
  } as PerformanceEventTiming;
}
