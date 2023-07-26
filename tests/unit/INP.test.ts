import { beforeEach, describe, expect, test } from "@jest/globals";
import * as INP from "../../src/metric/INP";

describe("INP", () => {
  beforeEach(() => {
    INP.reset();
  });

  test("first-input entries are considered for INP if there is no matching interaction event", () => {
    let interactions = 0;

    // Create 50 interactions so that we go over the threshold for using the high percentile value
    while (interactions < 50) {
      interactions++;
      INP.addEntry(makeEntry(interactions, 100));
    }

    // Create duplicate event and first-input entries
    INP.addEntry(makeEntry(60, 300, "event"));
    INP.addEntry(makeEntry(0, 300, "first-input"));

    // The first-input entry should be ignored, so the high percentile value is one of the first
    // 50 interactions.
    expect(INP.getHighPercentileINP()).toEqual(100);

    // Now create a unique first-input entry that becomes the high percentile value
    INP.addEntry(makeEntry(61, 200, "first-input"));

    expect(INP.getHighPercentileINP()).toEqual(200);
  });

  test("INP is calculated correctly for small sets of interactions", () => {
    INP.addEntry(makeEntry(1, 100));
    INP.addEntry(makeEntry(2, 200));
    INP.addEntry(makeEntry(3, 300));
    INP.addEntry(makeEntry(0, 400));

    expect(INP.getHighPercentileINP()).toEqual(300);
  });

  test("INP is calculated correctly for small sets of interactions with duplicate IDs", () => {
    INP.addEntry(makeEntry(1, 100));
    INP.addEntry(makeEntry(1, 110));
    INP.addEntry(makeEntry(2, 200));
    INP.addEntry(makeEntry(3, 300));
    INP.addEntry(makeEntry(3, 290));
    INP.addEntry(makeEntry(4, 220));
    INP.addEntry(makeEntry(4, 200));
    INP.addEntry(makeEntry(0, 990));
    INP.addEntry(makeEntry(0, 400));

    expect(INP.getHighPercentileINP()).toEqual(300);
  });

  test("INP is calculated correctly for large sets of interactions", () => {
    // Generate some long interactions
    INP.addEntry(makeEntry(1, 600));
    INP.addEntry(makeEntry(2, 400));
    INP.addEntry(makeEntry(3, 200));

    let interactions = 3;

    // And some shorter ones to make 50 total interactions (50 is the point at which we use an
    // estimated high percentile value rather than the longest value
    while (interactions < 50) {
      interactions++;
      INP.addEntry(makeEntry(interactions, 50));
    }

    expect(INP.getHighPercentileINP()).toEqual(400);

    // The logic to estimate the high percentile is basically to use the Nth slowest interaction,
    // where N is the interaction count divided by 50. So at 100 interactions we should use the
    // third-slowest interaction
    while (interactions < 100) {
      interactions++;
      INP.addEntry(makeEntry(interactions, 50));
    }

    expect(INP.getHighPercentileINP()).toEqual(200);
  });

  test("INP is calculated correctly for large sets of interactions with duplicate IDs", () => {
    // Generate some duplicate long interactions
    INP.addEntry(makeEntry(1, 590));
    INP.addEntry(makeEntry(1, 600));
    INP.addEntry(makeEntry(1, 580));
    INP.addEntry(makeEntry(2, 400));
    INP.addEntry(makeEntry(2, 399));
    INP.addEntry(makeEntry(2, 390));
    INP.addEntry(makeEntry(2, 400));
    INP.addEntry(makeEntry(3, 200));
    INP.addEntry(makeEntry(3, 200));

    expect(INP.getHighPercentileINP()).toEqual(600);

    let interactions = 3;

    // And some shorter ones to make 50 total interactions (50 is the point at which we use an
    // estimated high percentile value rather than the longest value
    while (interactions < 50) {
      interactions++;
      INP.addEntry(makeEntry(interactions, 50));
    }

    expect(INP.getHighPercentileINP()).toEqual(400);

    // The logic to estimate the high percentile is basically to use the Nth slowest interaction,
    // where N is the interaction count divided by 50. So at 100 interactions we should use the
    // third-slowest interaction
    while (interactions < 100) {
      interactions++;
      INP.addEntry(makeEntry(interactions, 50));
    }

    expect(INP.getHighPercentileINP()).toEqual(200);
  });
});

function makeEntry(
  interactionId: number,
  duration: number,
  entryType = "event",
): PerformanceEventTiming {
  return {
    interactionId,
    duration,
    entryType,
    startTime: 0,
  } as PerformanceEventTiming;
}
