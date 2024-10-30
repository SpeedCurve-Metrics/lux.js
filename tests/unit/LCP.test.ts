import { describe, expect, test, beforeEach } from "@jest/globals";
import * as LCP from "../../src/metric/LCP";
import { setPageRestoreTime } from "../../src/timing";

describe("LCP", () => {
  beforeEach(() => {
    LCP.reset();
  });

  test("LCP reports the latest value", () => {
    LCP.processEntry({ startTime: 300 } as LargestContentfulPaint);
    LCP.processEntry({ startTime: 200 } as LargestContentfulPaint);
    LCP.processEntry({ startTime: 100 } as LargestContentfulPaint);

    const data = LCP.getData()!;

    expect(data.value).toEqual(300);
    expect(data.attribution).toBeNull();
    expect(data.subParts).toBeNull();
  });

  test("LCP takes page restore time into account", () => {
    setPageRestoreTime(1000);
    LCP.processEntry({ startTime: 2000 } as LargestContentfulPaint);
    expect(LCP.getData()!.value).toEqual(1000);
    setPageRestoreTime(0);
  });

  test("LCP can be zero", () => {
    setPageRestoreTime(1000);
    LCP.processEntry({ startTime: 1000 } as LargestContentfulPaint);
    expect(LCP.getData()!.value).toEqual(0);
    setPageRestoreTime(0);
  });

  test("LCP ignores invalid entries", () => {
    LCP.processEntry({ startTime: -100 } as LargestContentfulPaint);
    expect(LCP.getData()).toBeUndefined();

    setPageRestoreTime(1000);
    expect(LCP.getData()).toBeUndefined();
    setPageRestoreTime(0);
  });
});
