import { ConfigObject } from "./config";
import { wasPrerendered } from "./document";
import Flags, { addFlag } from "./flags";
import { addListener } from "./listeners";
import Logger, { LogEvent } from "./logger";
import { NavigationTimingData } from "./metric/navigation-timing";
import { getPageRestoreTime, getZeroTime, msSincePageInit } from "./timing";
import { VERSION } from "./version";

const sendBeaconFallback = (url: string | URL, data?: BodyInit | null) => {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("content-type", "application/json");
  xhr.send(String(data));

  return true;
};

const sendBeacon =
  "sendBeacon" in navigator ? navigator.sendBeacon.bind(navigator) : sendBeaconFallback;

/**
 * Some values should only be reported if they are non-zero. The exception to this is when the page
 * was prerendered or restored from BF cache
 */
export function shouldReportValue(value: number) {
  if (getPageRestoreTime() || wasPrerendered()) {
    return value >= 0;
  }

  return value > 0;
}

/**
 * Fit an array of user timing delimited strings into a URL and return both the entries that fit and
 * the remaining entries that didn't fit.
 */
export function fitUserTimingEntries(utValues: string[], config: ConfigObject, url: string) {
  // Start with the maximum allowed UT entries per beacon
  const beaconUtValues = utValues.slice(0, config.maxBeaconUTEntries);
  const remainingUtValues = utValues.slice(config.maxBeaconUTEntries);

  // Trim UT entries until they fit within the maximum URL length, ensuring at least one UT entry
  // is included.
  while (
    (url + "&UT=" + beaconUtValues.join(",")).length > config.maxBeaconUrlLength &&
    beaconUtValues.length > 1
  ) {
    remainingUtValues.unshift(beaconUtValues.pop()!);
  }

  return [beaconUtValues, remainingUtValues];
}

type BeaconOptions = {
  config: ConfigObject;
  logger: Logger;
  customerId: string;
  sessionId: string;
  pageId: string;
  startTime?: number;
};

export class Beacon {
  config: ConfigObject;
  logger: Logger;
  isRecording = true;
  isSent = false;
  sendRetries = 0;
  maxMeasureTimeout = 0;

  customerId: string;
  pageId: string;
  sessionId: string;
  flags = 0;

  startTime: number;
  metricData: Partial<BeaconMetricData>;

  onBeforeSendCbs: Array<() => void> = [];

  constructor(opts: BeaconOptions) {
    this.startTime = opts.startTime || getZeroTime();
    this.config = opts.config;
    this.logger = opts.logger;
    this.customerId = opts.customerId;
    this.sessionId = opts.sessionId;
    this.pageId = opts.pageId;
    this.metricData = {};

    this.maxMeasureTimeout = window.setTimeout(() => {
      this.logger.logEvent(LogEvent.PostBeaconTimeoutReached);
      this.stopRecording();
      this.send();
    }, this.config.maxMeasureTime - msSincePageInit());

    addListener("securitypolicyviolation", (e: SecurityPolicyViolationEvent) => {
      if (e.disposition !== "report" && e.blockedURI === this.config.beaconUrlV2 && "URL" in self) {
        // Some websites might have CSP rules that allow the GET beacon, but not the POST beacon.
        // We can detect this here and attempt to send the beacon to a fallback endpoint.
        //
        // If the fallback endpoint has not been provided in the config, we will fall back to using
        // the POST beacon pathname on the GET beacon origin.
        if (!this.config.beaconUrlFallback) {
          const getOrigin = new URL(this.config.beaconUrl).origin;
          const postPathname = new URL(this.config.beaconUrlV2).pathname;
          this.config.beaconUrlFallback = getOrigin + postPathname;
        }

        // Update the V2 beacon URL
        this.config.beaconUrlV2 = this.config.beaconUrlFallback!;
        this.logger.logEvent(LogEvent.PostBeaconCSPViolation, [this.config.beaconUrlV2]);
        this.addFlag(Flags.BeaconBlockedByCsp);

        // Not all browsers return false if sendBeacon fails. In this case, `this.isSent` will be
        // true, even though the beacon wasn't sent. We need to reset this flag to ensure we can
        // retry sending the beacon.
        this.isSent = false;

        // Try to send the beacon again
        if (this.sendRetries < 1) {
          this.sendRetries++;
          this.send();
        }
      }
    });

    this.logger.logEvent(LogEvent.PostBeaconInitialised);
  }

  isBeingSampled() {
    const bucket = parseInt(String(this.sessionId).slice(-2));

    return bucket < this.config.samplerate;
  }

  stopRecording() {
    this.isRecording = false;
    this.logger.logEvent(LogEvent.PostBeaconStopRecording);
  }

  setMetricData<K extends keyof BeaconMetricData>(metric: K, data: BeaconMetricData[K]) {
    if (!this.isRecording) {
      this.logger.logEvent(LogEvent.PostBeaconMetricRejected, [metric]);
      return;
    }

    this.metricData[metric] = data;
  }

  addFlag(flag: number) {
    this.flags = addFlag(this.flags, flag);
  }

  hasMetricData() {
    return Object.keys(this.metricData).length > 0;
  }

  beaconUrl() {
    return this.config.beaconUrlV2;
  }

  onBeforeSend(cb: () => void) {
    this.onBeforeSendCbs.push(cb);
  }

  send() {
    this.logger.logEvent(LogEvent.PostBeaconSendCalled);

    if (!this.config.enablePostBeacon) {
      this.logger.logEvent(LogEvent.PostBeaconDisabled);
      return;
    }

    for (const cb of this.onBeforeSendCbs) {
      cb();
    }

    if (!this.isBeingSampled()) {
      return;
    }

    if (!this.hasMetricData() && !this.config.allowEmptyPostBeacon) {
      // TODO: This is only required while the new beacon is supplementary. Once it's the primary
      // beacon, we should send it regardless of how much metric data it has.
      this.logger.logEvent(LogEvent.PostBeaconCancelled);
      return;
    }

    if (this.isSent) {
      this.logger.logEvent(LogEvent.PostBeaconAlreadySent);
      return;
    }

    // Only clear the max measure timeout if there's data to send.
    clearTimeout(this.maxMeasureTimeout);

    const beaconUrl = this.beaconUrl();
    const payload: BeaconPayload = Object.assign(
      {
        customerId: this.customerId,
        flags: this.flags,
        measureDuration: msSincePageInit(),
        pageId: this.pageId,
        scriptVersion: VERSION,
        sessionId: this.sessionId,
        startTime: this.startTime,
      },
      this.metricData,
    );

    try {
      if (sendBeacon(beaconUrl, JSON.stringify(payload))) {
        this.isSent = true;
        this.logger.logEvent(LogEvent.PostBeaconSent, [beaconUrl, payload]);
      }
    } catch (e) {
      // Intentionally empty; handled below
    }

    if (!this.isSent) {
      this.logger.logEvent(LogEvent.PostBeaconSendFailed, [beaconUrl, payload]);
    }
  }
}

export type BeaconPayload = BeaconMetaData & Partial<BeaconMetricData>;

export type BeaconMetaData = {
  customerId: string;
  pageId: string;
  sessionId: string;
  flags: number;

  /** When this beacon started measuring */
  startTime: number;

  /** The lux.js version that sent the beacon */
  scriptVersion: string;

  /** How long in milliseconds did this beacon capture page data for */
  measureDuration: number;
};

export type BeaconMetricData = {
  navigationTiming: NavigationTimingData;
  lcp: Metric & {
    attribution: MetricAttribution | null;

    /** LCP sub-parts can be null if the LCP element was not loaded by a resource */
    subParts: {
      resourceLoadDelay: number;
      resourceLoadTime: number;
      elementRenderDelay: number;
    } | null;
  };

  inp: Metric & {
    startTime: number;
    attribution: (MetricAttribution & { eventType: string }) | null;
    subParts: {
      inputDelay: number;
      processingTime: number;
      presentationDelay: number;
    };
  };

  cls: Metric & {
    startTime: number | null;
    /** Largest entry can be null if there were no layout shifts (value will be 0) */
    largestEntry: {
      value: number;
      startTime: number;
    } | null;
    sources: CLSAttribution[] | null;
  };
};

export type CLSAttribution = MetricAttribution & {
  value: number;
  startTime: number;
};

type Metric = {
  value: number;
};

type MetricAttribution = {
  elementSelector: string;
  elementType: string;
};
