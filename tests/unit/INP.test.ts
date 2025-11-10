import { beforeEach, describe, expect, test } from "@jest/globals";
import * as Config from "../../src/config";
import * as INP from "../../src/metric/INP";
import "../../src/window.d.ts";
import { Writable } from "../../src/types";

const config = Config.fromObject({});

describe("INP", () => {
  beforeEach(() => {
    INP.reset();
  });

  test("first-input entries are considered for INP if there is no matching interaction event", () => {
    let interactions = 0;

    // Create 50 interactions so that we go over the threshold for using the high percentile value
    while (interactions < 50) {
      interactions++;
      INP.processEntry(makeEntry({ interactionId: interactions, duration: 100 }));
    }

    // Create duplicate event and first-input entries
    INP.processEntry(makeEntry({ interactionId: 60, duration: 300 }));
    INP.processEntry(makeEntry({ interactionId: 0, duration: 300, entryType: "first-input" }));

    // The first-input entry should be ignored, so the high percentile value is one of the first
    // 50 interactions.
    expect(INP.getData(config)!.value).toEqual(100);

    // Now create a unique first-input entry that becomes the high percentile value
    INP.processEntry(makeEntry({ interactionId: 61, duration: 200, entryType: "first-input" }));

    expect(INP.getData(config)!.value).toEqual(200);
  });

  test("INP is calculated correctly for small sets of interactions", () => {
    INP.processEntry(makeEntry({ interactionId: 1, startTime: 10, duration: 100 }));
    INP.processEntry(makeEntry({ interactionId: 2, startTime: 20, duration: 200 }));
    INP.processEntry(makeEntry({ interactionId: 3, startTime: 30, duration: 300 }));
    INP.processEntry(makeEntry({ interactionId: 0, startTime: 40, duration: 400 }));

    const data = INP.getData(config)!;

    expect(data.value).toEqual(300);
    expect(data.startTime).toEqual(30);
    expect(data.attribution!.eventType).toEqual("pointerdown");
  });

  test("INP is calculated correctly for small sets of interactions with duplicate IDs", () => {
    INP.processEntry(makeEntry({ interactionId: 1, duration: 100 }));
    INP.processEntry(makeEntry({ interactionId: 1, duration: 110 }));
    INP.processEntry(makeEntry({ interactionId: 2, duration: 200 }));
    INP.processEntry(makeEntry({ interactionId: 3, duration: 300 }));
    INP.processEntry(makeEntry({ interactionId: 3, duration: 290 }));
    INP.processEntry(makeEntry({ interactionId: 4, duration: 220 }));
    INP.processEntry(makeEntry({ interactionId: 4, duration: 200 }));
    INP.processEntry(makeEntry({ interactionId: 0, duration: 990 }));
    INP.processEntry(makeEntry({ interactionId: 0, duration: 400 }));

    expect(INP.getData(config)!.value).toEqual(300);
  });

  test("INP is calculated correctly for large sets of interactions", () => {
    // Generate some long interactions
    INP.processEntry(makeEntry({ interactionId: 1, duration: 600 }));
    INP.processEntry(makeEntry({ interactionId: 2, duration: 400 }));
    INP.processEntry(makeEntry({ interactionId: 3, duration: 200 }));

    let interactions = 3;

    // And some shorter ones to make 50 total interactions (50 is the point at which we use an
    // estimated high percentile value rather than the longest value
    while (interactions < 50) {
      interactions++;
      INP.processEntry(makeEntry({ interactionId: interactions, duration: 50 }));
    }

    expect(INP.getData(config)!.value).toEqual(400);

    // The logic to estimate the high percentile is basically to use the Nth slowest interaction,
    // where N is the interaction count divided by 50. So at 100 interactions we should use the
    // third-slowest interaction
    while (interactions < 100) {
      interactions++;
      INP.processEntry(makeEntry({ interactionId: interactions, duration: 50 }));
    }

    expect(INP.getData(config)!.value).toEqual(200);
  });

  test("INP is calculated correctly for large sets of interactions with duplicate IDs", () => {
    // Generate some duplicate long interactions
    INP.processEntry(makeEntry({ interactionId: 1, duration: 590 }));
    INP.processEntry(makeEntry({ interactionId: 1, duration: 600 }));
    INP.processEntry(makeEntry({ interactionId: 1, duration: 580 }));
    INP.processEntry(makeEntry({ interactionId: 2, duration: 400 }));
    INP.processEntry(makeEntry({ interactionId: 2, duration: 399 }));
    INP.processEntry(makeEntry({ interactionId: 2, duration: 390 }));
    INP.processEntry(makeEntry({ interactionId: 2, duration: 400 }));
    INP.processEntry(makeEntry({ interactionId: 3, duration: 200 }));
    INP.processEntry(makeEntry({ interactionId: 3, duration: 200 }));

    expect(INP.getData(config)!.value).toEqual(600);

    let interactions = 3;

    // And some shorter ones to make 50 total interactions (50 is the point at which we use an
    // estimated high percentile value rather than the longest value
    while (interactions < 50) {
      interactions++;
      INP.processEntry(makeEntry({ interactionId: interactions, duration: 50 }));
    }

    expect(INP.getData(config)!.value).toEqual(400);

    // The logic to estimate the high percentile is basically to use the Nth slowest interaction,
    // where N is the interaction count divided by 50. So at 100 interactions we should use the
    // third-slowest interaction
    while (interactions < 100) {
      interactions++;
      INP.processEntry(makeEntry({ interactionId: interactions, duration: 50 }));
    }

    expect(INP.getData(config)!.value).toEqual(200);
  });

  test("Entries with a longer processing time are preferred", () => {
    const entry1 = makeEntry({ interactionId: 1, duration: 100 });
    const entry2 = makeEntry({ interactionId: 1, duration: 100 });
    entry1.processingEnd = 10;
    entry2.processingEnd = 20;

    INP.processEntry(entry1);
    INP.processEntry(entry2);

    expect(INP.getHighPercentileInteraction()!.processingEnd).toEqual(20);
  });
});

function makeEntry(props: Partial<PerformanceEventTiming>): Writable<PerformanceEventTiming> {
  return {
    interactionId: 0,
    duration: 0,
    entryType: "event",
    name: "pointerdown",
    startTime: 0,
    processingStart: 0,
    processingEnd: 0,
    ...props,
  } as PerformanceEventTiming;
}
