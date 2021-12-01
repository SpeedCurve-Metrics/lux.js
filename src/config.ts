export interface ConfigObject {
  auto: boolean;
  beaconMode: "simple" | "autoupdate";
  beaconUrl: string;
  customerid?: string;
  jspagelabel?: string;
  maxMeasureTime: number;
  measureUntil: "onload" | "pagehidden";
  samplerate: number;
  sendBeaconOnPageHidden: boolean;
}

type MaybeConfigObject = Partial<ConfigObject>;

export function fromObject(obj: MaybeConfigObject): ConfigObject {
  const autoMode = getProperty(obj, "auto", true);

  return {
    auto: autoMode,
    beaconMode: getProperty(obj, "beaconMode", "simple"),
    beaconUrl: getProperty(obj, "beaconUrl", "https://lux.speedcurve.com/lux/"),
    customerid: getProperty(obj, "customerid", undefined),
    jspagelabel: getProperty(obj, "jspagelabel", undefined),
    maxMeasureTime: getProperty(obj, "maxMeasureTime", 60_000),
    measureUntil: getProperty(obj, "measureUntil", "onload"),
    samplerate: getProperty(obj, "samplerate", 100),
    sendBeaconOnPageHidden: getProperty(obj, "sendBeaconOnPageHidden", autoMode),
  };
}

export function getProperty<T, K extends keyof T, D>(
  obj: T,
  key: K,
  defaultValue: D
): Exclude<T[K], undefined> | D {
  if (typeof obj[key] !== "undefined") {
    return obj[key] as Exclude<T[K], undefined>;
  }

  return defaultValue;
}
