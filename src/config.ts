import { LuxGlobal } from "./global";
import { ServerTimingConfig } from "./server-timing";
import { UrlPatternMapping } from "./url-matcher";

export interface ConfigObject {
  allowEmptyPostBeacon: boolean;
  auto: boolean;
  beaconUrl: string;
  beaconUrlFallback?: string;
  beaconUrlV2: string;
  conversions?: UrlPatternMapping;
  cookieDomain?: string;
  customerid?: string;
  errorBeaconUrl: string;
  interactionBeaconDelay: number;
  jspagelabel?: string;
  label?: string;
  maxAttributionEntries: number;
  maxBeaconUrlLength: number;
  maxBeaconUTEntries: number;
  maxErrors: number;
  maxMeasureTime: number;
  measureUntil: "onload" | "pagehidden";
  minMeasureTime: number;
  newBeaconOnPageShow: boolean;
  pagegroups?: UrlPatternMapping;
  samplerate: number;
  sendBeaconOnPageHidden: boolean;
  serverTiming?: ServerTimingConfig;
  snippetVersion?: LuxGlobal["snippetVersion"];
  trackErrors: boolean;
  trackHiddenPages: boolean;
}

export type UserConfig = Partial<ConfigObject>;

const luxOrigin = "https://lux.speedcurve.com";

export function fromObject(obj: UserConfig): ConfigObject {
  const autoMode = getProperty(obj, "auto", true);

  return {
    allowEmptyPostBeacon: getProperty(obj, "allowEmptyPostBeacon", false),
    auto: autoMode,
    beaconUrl: getProperty(obj, "beaconUrl", luxOrigin + "/lux/"),
    beaconUrlFallback: getProperty(obj, "beaconUrlFallback"),
    beaconUrlV2: getProperty(obj, "beaconUrlV2", "https://beacon.speedcurve.com/store"),
    conversions: getProperty(obj, "conversions"),
    cookieDomain: getProperty(obj, "cookieDomain"),
    customerid: getProperty(obj, "customerid"),
    errorBeaconUrl: getProperty(obj, "errorBeaconUrl", luxOrigin + "/error/"),
    interactionBeaconDelay: getProperty(obj, "interactionBeaconDelay", 200),
    jspagelabel: getProperty(obj, "jspagelabel"),
    label: getProperty(obj, "label"),
    maxAttributionEntries: getProperty(obj, "maxAttributionEntries", 25),
    maxBeaconUrlLength: getProperty(obj, "maxBeaconUrlLength", 8190),
    maxBeaconUTEntries: getProperty(obj, "maxBeaconUTEntries", 20),
    maxErrors: getProperty(obj, "maxErrors", 5),
    maxMeasureTime: getProperty(obj, "maxMeasureTime", 60_000),
    measureUntil: getProperty(obj, "measureUntil", "onload"),
    minMeasureTime: getProperty(obj, "minMeasureTime", 0),
    newBeaconOnPageShow: getProperty(obj, "newBeaconOnPageShow", false),
    pagegroups: getProperty(obj, "pagegroups"),
    samplerate: getProperty(obj, "samplerate", 100),
    sendBeaconOnPageHidden: getProperty(obj, "sendBeaconOnPageHidden", autoMode),
    serverTiming: getProperty(obj, "serverTiming"),
    trackErrors: getProperty(obj, "trackErrors", true),
    trackHiddenPages: getProperty(obj, "trackHiddenPages", false),
  };
}

export function getProperty<T, K extends keyof T>(
  obj: T,
  key: K,
): Exclude<T[K], undefined> | undefined;
export function getProperty<T, K extends keyof T, D>(
  obj: T,
  key: K,
  defaultValue: D,
): Exclude<T[K], undefined> | D;
export function getProperty<T, K extends keyof T, D>(
  obj: T,
  key: K,
  defaultValue?: D,
): Exclude<T[K], undefined> | D | undefined {
  if (typeof obj[key] !== "undefined") {
    return obj[key] as Exclude<T[K], undefined>;
  }

  return defaultValue;
}
