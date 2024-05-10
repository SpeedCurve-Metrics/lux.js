import { beforeEach, describe, expect, test } from "@jest/globals";
import * as INP from "../../src/metric/INP";
import "../../src/window.d.ts";

describe("INP", () => {
  beforeEach(() => {
    INP.reset();
  });

  test("first-input entries are considered for INP if there is no matching interaction event", () => {
    let interactions = 0;

    // Create 50 interactions so that we go over the threshold for using the high percentile value
    while (interactions < 50) {
      interactions++;
      INP.addEntry(makeEntry({ interactionId: interactions, duration: 100 }));
    }

    // Create duplicate event and first-input entries
    INP.addEntry(makeEntry({ interactionId: 60, duration: 300 }));
    INP.addEntry(makeEntry({ interationId: 0, duration: 300, entryType: "first-input" }));

    // The first-input entry should be ignored, so the high percentile value is one of the first
    // 50 interactions.
    expect(INP.getHighPercentileInteraction()!.duration).toEqual(100);

    // Now create a unique first-input entry that becomes the high percentile value
    INP.addEntry(makeEntry({ interationId: 61, duration: 200, entryType: "first-input" }));

    expect(INP.getHighPercentileInteraction()!.duration).toEqual(200);
  });

  test("INP is calculated correctly for small sets of interactions", () => {
    INP.addEntry(makeEntry({ interactionId: 1, duration: 100 }));
    INP.addEntry(makeEntry({ interactionId: 2, duration: 200 }));
    INP.addEntry(makeEntry({ interactionId: 3, duration: 300 }));
    INP.addEntry(makeEntry({ interactionId: 0, duration: 400 }));

    expect(INP.getHighPercentileInteraction()!.duration).toEqual(300);
  });

  test("INP is calculated correctly for small sets of interactions with duplicate IDs", () => {
    INP.addEntry(makeEntry({ interactionId: 1, duration: 100 }));
    INP.addEntry(makeEntry({ interactionId: 1, duration: 110 }));
    INP.addEntry(makeEntry({ interactionId: 2, duration: 200 }));
    INP.addEntry(makeEntry({ interactionId: 3, duration: 300 }));
    INP.addEntry(makeEntry({ interactionId: 3, duration: 290 }));
    INP.addEntry(makeEntry({ interactionId: 4, duration: 220 }));
    INP.addEntry(makeEntry({ interactionId: 4, duration: 200 }));
    INP.addEntry(makeEntry({ interactionId: 0, duration: 990 }));
    INP.addEntry(makeEntry({ interactionId: 0, duration: 400 }));

    expect(INP.getHighPercentileInteraction()!.duration).toEqual(300);
  });

  test("INP is calculated correctly for large sets of interactions", () => {
    // Generate some long interactions
    INP.addEntry(makeEntry({ interactionId: 1, duration: 600 }));
    INP.addEntry(makeEntry({ interactionId: 2, duration: 400 }));
    INP.addEntry(makeEntry({ interactionId: 3, duration: 200 }));

    let interactions = 3;

    // And some shorter ones to make 50 total interactions (50 is the point at which we use an
    // estimated high percentile value rather than the longest value
    while (interactions < 50) {
      interactions++;
      INP.addEntry(makeEntry({ interactionId: interactions, duration: 50 }));
    }

    expect(INP.getHighPercentileInteraction()!.duration).toEqual(400);

    // The logic to estimate the high percentile is basically to use the Nth slowest interaction,
    // where N is the interaction count divided by 50. So at 100 interactions we should use the
    // third-slowest interaction
    while (interactions < 100) {
      interactions++;
      INP.addEntry(makeEntry({ interactionId: interactions, duration: 50 }));
    }

    expect(INP.getHighPercentileInteraction()!.duration).toEqual(200);
  });

  test("INP is calculated correctly for large sets of interactions with duplicate IDs", () => {
    // Generate some duplicate long interactions
    INP.addEntry(makeEntry({ interactionId: 1, duration: 590 }));
    INP.addEntry(makeEntry({ interactionId: 1, duration: 600 }));
    INP.addEntry(makeEntry({ interactionId: 1, duration: 580 }));
    INP.addEntry(makeEntry({ interactionId: 2, duration: 400 }));
    INP.addEntry(makeEntry({ interactionId: 2, duration: 399 }));
    INP.addEntry(makeEntry({ interactionId: 2, duration: 390 }));
    INP.addEntry(makeEntry({ interactionId: 2, duration: 400 }));
    INP.addEntry(makeEntry({ interactionId: 3, duration: 200 }));
    INP.addEntry(makeEntry({ interactionId: 3, duration: 200 }));

    expect(INP.getHighPercentileInteraction()!.duration).toEqual(600);

    let interactions = 3;

    // And some shorter ones to make 50 total interactions (50 is the point at which we use an
    // estimated high percentile value rather than the longest value
    while (interactions < 50) {
      interactions++;
      INP.addEntry(makeEntry({ interactionId: interactions, duration: 50 }));
    }

    expect(INP.getHighPercentileInteraction()!.duration).toEqual(400);

    // The logic to estimate the high percentile is basically to use the Nth slowest interaction,
    // where N is the interaction count divided by 50. So at 100 interactions we should use the
    // third-slowest interaction
    while (interactions < 100) {
      interactions++;
      INP.addEntry(makeEntry({ interactionId: interactions, duration: 50 }));
    }

    expect(INP.getHighPercentileInteraction()!.duration).toEqual(200);
  });

  test("Entries with a longer processing time are preferred", () => {
    const entry1 = makeEntry({ interactionId: 1, duration: 100 });
    const entry2 = makeEntry({ interactionId: 1, duration: 100 });
    entry1.processingEnd = 10;
    entry2.processingEnd = 20;

    INP.addEntry(entry1);
    INP.addEntry(entry2);

    expect(INP.getHighPercentileInteraction()!.processingEnd).toEqual(20);
  });
});

function makeEntry(props: Partial<PerformanceEventTiming>): PerformanceEventTiming {
  return {
    interactionId: 0,
    duration: 0,
    entryType: "event",
    startTime: 0,
    processingStart: 0,
    processingEnd: 0,
    ...props,
  } as PerformanceEventTiming;
}
