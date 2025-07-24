import { describe, expect, test } from "@jest/globals";
import * as Config from "../../src/config";

describe("Config.fromObject()", () => {
  test("it has default values when no config object is provided", () => {
    const config = Config.fromObject({});

    expect(config.auto).toEqual(true);
    expect(config.beaconUrl).toEqual("https://lux.speedcurve.com/lux/");
    expect(config.customerid).toBeUndefined();
    expect(config.errorBeaconUrl).toEqual("https://lux.speedcurve.com/error/");
    expect(config.jspagelabel).toBeUndefined();
    expect(config.label).toBeUndefined();
    expect(config.maxErrors).toEqual(5);
    expect(config.maxMeasureTime).toEqual(60_000);
    expect(config.measureUntil).toEqual("onload");
    expect(config.minMeasureTime).toEqual(0);
    expect(config.newBeaconOnPageShow).toEqual(false);
    expect(config.samplerate).toEqual(100);
    expect(config.sendBeaconOnPageHidden).toEqual(true);
    expect(config.spaMode).toEqual(false);
    expect(config.trackErrors).toEqual(true);
    expect(config.trackHiddenPages).toEqual(false);
  });

  test("it uses values from the config object when they are provided", () => {
    const config = Config.fromObject({
      trackErrors: false,
      samplerate: 50,
    });

    expect(config.samplerate).toEqual(50);
    expect(config.trackErrors).toEqual(false);
  });

  test("it allows sendBeaconOnPageHidden to be false in auto mode", () => {
    const config = Config.fromObject({
      sendBeaconOnPageHidden: false,
    });

    expect(config.sendBeaconOnPageHidden).toEqual(false);
  });

  test("it disables sendBeaconOnPageHidden when auto is set to false", () => {
    const config = Config.fromObject({
      auto: false,
    });

    expect(config.sendBeaconOnPageHidden).toEqual(false);
  });

  test("it allows sendBeaconOnPageHidden to be true even when auto is set to false", () => {
    const config = Config.fromObject({
      auto: false,
      sendBeaconOnPageHidden: true,
    });

    expect(config.sendBeaconOnPageHidden).toEqual(true);
  });

  test("it sets sensible defaults in SPA mode", () => {
    const config = Config.fromObject({
      spaMode: true,
    });

    expect(config.auto).toEqual(false);
    expect(config.measureUntil).toEqual("pagehidden");
    expect(config.sendBeaconOnPageHidden).toEqual(true);
    expect(config.spaMode).toEqual(true);
  });

  test("SPA mode defaults can be overridden, except for auto", () => {
    const config = Config.fromObject({
      auto: true,
      spaMode: true,
      sendBeaconOnPageHidden: false,
    });

    expect(config.auto).toEqual(false);
    expect(config.sendBeaconOnPageHidden).toEqual(false);
  });
});
