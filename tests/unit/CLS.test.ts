import { describe, expect, test } from "@jest/globals";
import * as CLS from "../../src/metric/CLS";

describe("CLS", () => {
  test("CLS is windowed", () => {
    CLS.addEntry(makeEntry(100, 0.01));
    CLS.addEntry(makeEntry(120, 0.01));
    CLS.addEntry(makeEntry(1000, 0.01));
    expect(CLS.getCLS()).toEqual(0.03);

    // New window because it was >= 1000ms since the last entry
    CLS.addEntry(makeEntry(2000, 0.01));
    expect(CLS.getCLS()).toEqual(0.01);

    CLS.addEntry(makeEntry(2800, 0.01));
    CLS.addEntry(makeEntry(3600, 0.01));
    CLS.addEntry(makeEntry(4400, 0.01));
    CLS.addEntry(makeEntry(5200, 0.01));
    CLS.addEntry(makeEntry(6000, 0.01));
    CLS.addEntry(makeEntry(6800, 0.01));

    // New window because despite all the entries being 800ms apart, the first entry in the current
    // window (at 2000ms) was >= 5000ms ago
    CLS.addEntry(makeEntry(7600, 0.01));
    CLS.addEntry(makeEntry(8400, 0.01));
    expect(CLS.getCLS()).toEqual(0.02);
  });
});

function makeEntry(startTime: number, value: number, hadRecentInput = false): LayoutShift {
  return {
    startTime,
    value,
    hadRecentInput,
  } as LayoutShift;
}
