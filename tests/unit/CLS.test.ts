import { describe, expect, test } from "@jest/globals";
import * as CLS from "../../src/metric/CLS";

describe("CLS", () => {
  test("CLS is windowed", () => {
    CLS.addEntry(makeEntry(100, 0.1));
    CLS.addEntry(makeEntry(120, 0.2));
    CLS.addEntry(makeEntry(1000, 0.1));
    expect(CLS.getCLS()).toBeCloseTo(0.4);

    // New window because it was >= 1000ms since the last entry
    CLS.addEntry(makeEntry(2000, 0.5));
    expect(CLS.getCLS()).toBeCloseTo(0.5);

    // Same window
    CLS.addEntry(makeEntry(2800, 0.1));
    CLS.addEntry(makeEntry(3600, 0.1));
    CLS.addEntry(makeEntry(4400, 0.1));
    CLS.addEntry(makeEntry(5200, 0.1));
    CLS.addEntry(makeEntry(6000, 0.1));
    CLS.addEntry(makeEntry(6800, 0.1));
    expect(CLS.getCLS()).toBeCloseTo(1.1);

    // New window because despite all the entries being 800ms apart, the first entry in the current
    // window (at 2000ms) was >= 5000ms ago
    CLS.addEntry(makeEntry(7600, 0.3));
    CLS.addEntry(makeEntry(8400, 0.1));

    // Score didn't change because the biggest window was still the previous window
    expect(CLS.getCLS()).toBeCloseTo(1.1);
  });
});

function makeEntry(startTime: number, value: number, hadRecentInput = false): LayoutShift {
  return {
    startTime,
    value,
    hadRecentInput,
  } as LayoutShift;
}
