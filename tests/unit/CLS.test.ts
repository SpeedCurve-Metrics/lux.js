import { describe, expect, test } from "@jest/globals";
import * as Config from "../../src/config";
import * as CLS from "../../src/metric/CLS";

const config = Config.fromObject({});

// Mock LayoutShift support so the CLS.getData() returns a value.
self.LayoutShift = () => {};

describe("CLS", () => {
  test("CLS is windowed", () => {
    CLS.processEntry(makeEntry(100, 0.1));
    CLS.processEntry(makeEntry(120, 0.2));
    CLS.processEntry(makeEntry(1000, 0.1));
    expect(CLS.getData(config)!.value).toBeCloseTo(0.4);

    // New window because it was >= 1000ms since the last entry
    CLS.processEntry(makeEntry(2000, 0.5));
    expect(CLS.getData(config)!.value).toBeCloseTo(0.5);

    // Same window
    CLS.processEntry(makeEntry(2800, 0.1));
    CLS.processEntry(makeEntry(3600, 0.1));
    CLS.processEntry(makeEntry(4400, 0.1));
    CLS.processEntry(makeEntry(5200, 0.1));
    CLS.processEntry(makeEntry(6000, 0.1));
    CLS.processEntry(makeEntry(6800, 0.1));
    expect(CLS.getData(config)!.value).toBeCloseTo(1.1);

    // New window because despite all the entries being 800ms apart, the first entry in the current
    // window (at 2000ms) was >= 5000ms ago
    CLS.processEntry(makeEntry(7600, 0.3));
    CLS.processEntry(makeEntry(8400, 0.1));

    // Score didn't change because the biggest window was still the previous window
    expect(CLS.getData(config)!.value).toBeCloseTo(1.1);
  });

  test("The number of sources is limited", () => {
    const entry1 = makeEntry(100, 0.1);
    entry1.sources = new Array(config.maxAttributionEntries * 1.2).fill({
      node: document.createElement("div"),
    });

    CLS.processEntry(entry1);

    expect(CLS.getData(config)!.sources).toHaveLength(config.maxAttributionEntries);
  });
});

function makeEntry(startTime: number, value: number, hadRecentInput = false): LayoutShift {
  return {
    startTime,
    value,
    hadRecentInput,
  } as LayoutShift;
}
