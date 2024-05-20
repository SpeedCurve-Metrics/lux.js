import { beforeEach, describe, expect, test } from "@jest/globals";
import * as INP from "../../src/metric/INP";
import "../../src/window.d.ts";

describe("INP", () => {
  beforeEach(() => {
    INP.reset();
  });

  test("Specific case for Andy", () => {
    const entries = [
      makeEntry({
        name: "pointerover",
        startTime: 58705,
        duration: 40,
        processingStart: 58735,
        processingEnd: 58736,
        interactionId: 0,
      }),
    ];

    for (let i = 0; i < 17; i++) {
      entries.push(
        makeEntry({
          name: "pointerenter",
          startTime: 58705,
          duration: 40,
          processingStart: 58735,
          processingEnd: 58736,
          interactionId: 0,
        }),
      );
    }

    entries.push(
      makeEntry({
        name: "pointerdown",
        startTime: 58705,
        duration: 40,
        processingStart: 58735,
        processingEnd: 58736,
        interactionId: 9640,
      }),
    );

    entries.push(
      makeEntry({
        name: "pointerup",
        startTime: 58712,
        duration: 96,
        processingStart: 58772,
        processingEnd: 58772,
        interactionId: 9640,
      }),
    );

    for (let i = 0; i < 17; i++) {
      entries.push(
        makeEntry({
          name: "pointerleave",
          startTime: 58712,
          duration: 96,
          processingStart: 58735,
          processingEnd: 58736,
          interactionId: 0,
        }),
      );
    }

    entries.push(
      makeEntry({
        name: "click",
        startTime: 58712,
        duration: 96,
        processingStart: 58735,
        processingEnd: 58751,
        interactionId: 9640,
      }),
    );

    entries.forEach(INP.addEntry);

    const inp = INP.getHighPercentileInteraction()!;
    console.log({
      slowestEntries: INP.getSlowestEntries(),
      interactionCount: INP.getInteractionCount(),
    });
    console.log({
      value: inp.duration,
      startTime: inp.startTime,
      inputDelay: inp.processingStart - inp.startTime,
      processingTime: inp.processingTime,
      presentationDelay: inp.startTime + inp.duration - inp.processingEnd,
      interactionId: inp.interactionId,
    });
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
