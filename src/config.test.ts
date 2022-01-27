import * as Config from "./config";

describe("Config.fromObject()", () => {
  it("has default values when no config object is provided", () => {
    const config = Config.fromObject({});

    expect(config.auto).toEqual(true);
    expect(config.beaconUrl).toEqual("https://lux.speedcurve.com/lux/");
    expect(config.customerid).toBeUndefined();
    expect(config.debug).toEqual(false);
    expect(config.jspagelabel).toBeUndefined();
    expect(config.label).toBeUndefined();
    expect(config.maxErrors).toEqual(5);
    expect(config.maxMeasureTime).toEqual(60_000);
    expect(config.measureUntil).toEqual("onload");
    expect(config.samplerate).toEqual(100);
    expect(config.sendBeaconOnPageHidden).toEqual(true);
    expect(config.trackErrors).toEqual(true);
  });

  it("uses values from the config object when they are provided", () => {
    const config = Config.fromObject({
      trackErrors: false,
      samplerate: 50,
    });

    expect(config.samplerate).toEqual(50);
    expect(config.trackErrors).toEqual(false);
  });

  it("disables sendBeaconOnPageHidden when auto is set to false", () => {
    const config = Config.fromObject({
      auto: false,
    });

    expect(config.sendBeaconOnPageHidden).toEqual(false);
  });

  it("allows sendBeaconOnPageHidden to be true even when auto is set to false", () => {
    const config = Config.fromObject({
      auto: false,
      sendBeaconOnPageHidden: true,
    });

    expect(config.sendBeaconOnPageHidden).toEqual(true);
  });
});
