export interface ConfigObject {
  auto: boolean;
  beaconUrl: string;
  customerid?: string;
  errorBeaconUrl: string;
  jspagelabel?: string;
  label?: string;
  maxBeaconUrlLength: number;
  maxBeaconUTEntries: number;
  maxErrors: number;
  maxMeasureTime: number;
  minMeasureTime: number;
  samplerate: number;
  sendBeaconOnPageHidden: boolean;
  trackErrors: boolean;
  pagegroups?: PageGroups;
}

interface PageGroups {
  [key: string]: string[];
}

export type UserConfig = Partial<ConfigObject>;

export function fromObject(obj: UserConfig): ConfigObject {
  const autoMode = getProperty(obj, "auto", true);

  return {
    auto: autoMode,
    beaconUrl: getProperty(obj, "beaconUrl", "https://lux.speedcurve.com/lux/"),
    customerid: getProperty(obj, "customerid", undefined),
    errorBeaconUrl: getProperty(obj, "errorBeaconUrl", "https://lux.speedcurve.com/error/"),
    jspagelabel: getProperty(obj, "jspagelabel", undefined),
    label: getProperty(obj, "label", undefined),
    maxBeaconUrlLength: getProperty(obj, "maxBeaconUrlLength", 8190),
    maxBeaconUTEntries: getProperty(obj, "maxBeaconUTEntries", 20),
    maxErrors: getProperty(obj, "maxErrors", 5),
    maxMeasureTime: getProperty(obj, "maxMeasureTime", 60_000),
    minMeasureTime: getProperty(obj, "minMeasureTime", 0),
    samplerate: getProperty(obj, "samplerate", 100),
    sendBeaconOnPageHidden: getProperty(obj, "sendBeaconOnPageHidden", autoMode),
    trackErrors: getProperty(obj, "trackErrors", true),
    pagegroups: getProperty(obj, "pagegroups", undefined),
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
