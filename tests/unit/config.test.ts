import { describe, expect, test } from "@jest/globals";
import * as Config from "../../src/config";

describe("Config.fromObject()", () => {
  test("it has default values when no config object is provided", () => {
    const config = Config.fromObject({});

    expect(config.auto).toEqual(true);
    expect(config.beaconUrl).toEqual("https://lux.speedcurve.com/lux/");
    expect(config.customerid).toBeUndefined();
    expect(config.jspagelabel).toBeUndefined();
    expect(config.label).toBeUndefined();
    expect(config.maxErrors).toEqual(5);
    expect(config.maxMeasureTime).toEqual(60_000);
    expect(config.minMeasureTime).toEqual(0);
    expect(config.samplerate).toEqual(100);
    expect(config.sendBeaconOnPageHidden).toEqual(true);
    expect(config.trackErrors).toEqual(true);
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
});
