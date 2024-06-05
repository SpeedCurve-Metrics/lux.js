import { ConfigObject } from "./config";
import Logger, { LogEvent } from "./logger";
import { msSincePageInit } from "./timing";
import { VERSION } from "./version";

const sendBeaconFallback = (url: string | URL, data?: BodyInit | null) => {
  const xhr = new XMLHttpRequest();
  xhr.open("POST", url, true);
  xhr.setRequestHeader("content-type", "application/json");
  xhr.send(String(data));
};

const sendBeacon =
  "sendBeacon" in navigator ? navigator.sendBeacon.bind(navigator) : sendBeaconFallback;

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
};

export class Beacon {
  config: ConfigObject;
  logger: Logger;
  customerId: string;
  pageId: string;
  sessionId: string;
  isRecording = true;
  isSent = false;
  metricData: Partial<MetricData>;
  maxMeasureTimeout = 0;

  constructor(opts: BeaconOptions) {
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
    }, this.config.maxMeasureTime);

    this.logger.logEvent(LogEvent.PostBeaconInitialised);
  }

  stopRecording() {
    this.isRecording = false;
    this.logger.logEvent(LogEvent.PostBeaconStopRecording);
  }

  setMetricData<K extends keyof MetricData>(metric: K, data: MetricData[K]) {
    if (!this.isRecording) {
      this.logger.logEvent(LogEvent.PostBeaconMetricRejected, [metric]);
      return;
    }

    this.metricData[metric] = data;
  }

  hasMetricData() {
    return Object.keys(this.metricData).length > 0;
  }

  beaconUrl() {
    return this.config.beaconUrlV2 || "https://dev.beacon.speedcurve.com/store";
  }

  send() {
    this.logger.logEvent(LogEvent.PostBeaconSendCalled);

    if (!this.hasMetricData()) {
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
        measureDuration: msSincePageInit(),
        pageId: this.pageId,
        scriptVersion: VERSION,
        sessionId: this.sessionId,
      },
      this.metricData,
    );

    sendBeacon(beaconUrl, JSON.stringify(payload));
    this.isSent = true;
    this.logger.logEvent(LogEvent.PostBeaconSent, [beaconUrl, payload]);
  }
}

type BeaconPayload = BeaconMetaData & Partial<MetricData>;

type BeaconMetaData = {
  customerId: string;
  pageId: string;
  sessionId: string;

  /** The lux.js version that sent the beacon */
  scriptVersion: string;

  /** How long in milliseconds did this beacon capture page data for */
  measureDuration: number;
};

export interface MetricData extends Record<string, Metric> {
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
    sources: CLSAttribution[];
  };
}

type CLSAttribution = MetricAttribution & {
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
