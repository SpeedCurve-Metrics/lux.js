import { describe, expect, test } from "@jest/globals";
import * as Config from "../../src/config";
import * as LoAF from "../../src/metric/LoAF";
import "../../src/window.d.ts";

const config = Config.fromObject({ maxAttributionEntries: 2 });

describe("LoAF", () => {
  test("LoAF scripts are summarized correctly", () => {
    LoAF.processEntry(
      makeEntry({
        startTime: 50,
        duration: 150,
        blockingDuration: 30,
        scripts: [
          { sourceURL: "short-script.js", startTime: 50, duration: 20 },
          { sourceURL: "medium-script.js", startTime: 70, duration: 30 },
          { sourceURL: "long-script.js", startTime: 100, duration: 100 },
        ],
      }),
    );

    LoAF.processEntry(
      makeEntry({
        startTime: 200,
        duration: 200,
        blockingDuration: 100,
        scripts: [
          { sourceURL: "short-script.js", startTime: 200, duration: 20 },
          { sourceURL: "medium-script.js", startTime: 220, duration: 30 },
          { sourceURL: "medium-script.js", startTime: 250, duration: 20 },
          { sourceURL: "long-script.js", startTime: 270, duration: 130 },
        ],
      }),
    );

    const result = LoAF.getData(config);

    expect(result.scripts.length).toEqual(2);

    expect(result.scripts[0].sourceUrl).toEqual("long-script.js");
    expect(result.scripts[0].totalDuration).toEqual(230);
    expect(result.scripts[0].totalEntries).toEqual(2);

    expect(result.scripts[1].sourceUrl).toEqual("medium-script.js");
    expect(result.scripts[1].totalDuration).toEqual(80);
    expect(result.scripts[1].totalEntries).toEqual(3);
  });
});

type MakeEntryArgs = {
  startTime: number;
  duration: number;
  blockingDuration: number;
  renderStart?: number;
  scripts?: Partial<PerformanceScriptTiming>[];
};

function makeEntry(args: MakeEntryArgs): PerformanceLongAnimationFrameTiming {
  const { startTime, duration, blockingDuration, scripts = [] } = args;
  const renderStart = args.renderStart || startTime;

  return {
    entryType: "long-animation-frame",
    sourceURL: "long-animation-frame",
    startTime,
    duration,
    blockingDuration,
    renderStart,
    styleAndLayoutStart: renderStart,
    scripts: scripts.map((script) => ({
      ...script,
      invoker: script.invoker || "",
      sourceFunctionName: script.sourceFunctionName || "",
      pauseDuration: script.pauseDuration || 0,
      forcedStyleAndLayoutDuration: script.forcedStyleAndLayoutDuration || 0,
    })),
  } as unknown as PerformanceLongAnimationFrameTiming;
}
