import type { ConfigObject, UserConfig } from "./config";
import { wasPrerendered } from "./document";
import * as Events from "./events";
import Flags, { addFlag } from "./flags";
import { addListener } from "./listeners";
import Logger, { LogEvent } from "./logger";
import type { LoAFScriptSummary, LoAFSummary } from "./metric/LoAF";
import type { NavigationTimingData } from "./metric/navigation-timing";
import * as PROPS from "./minification";
import now from "./now";
import { getPageRestoreTime, getZeroTime, msSincePageInit } from "./timing";
import { postJson } from "./transport";
import { VERSION } from "./version";

type BeaconOptions = {
  config: ConfigObject;
  logger: Logger;
  customerId: string;
  sessionId: string;
  pageId: string;
  startTime?: number;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type CollectorFunction = (config: UserConfig) => any;

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
    (url + "&UT=" + beaconUtValues.join(","))[PROPS.length] > config.maxBeaconUrlLength &&
    beaconUtValues[PROPS.length] > 1
  ) {
    remainingUtValues.unshift(beaconUtValues.pop()!);
  }

  return [beaconUtValues, remainingUtValues];
}

export class Beacon {
  public isSent = false;

  private _config: ConfigObject;
  private _logger: Logger;
  private _sendRetries = 0;
  private _maxMeasureTimeout = 0;

  private _customerId: string;
  private _pageId: string;
  private _sessionId: string;
  private _flags = 0;

  private _startTime: number;
  private _metricCollectors: { [k in BeaconMetricKey]?: CollectorFunction } = {};

  private _onBeforeSendCbs: Array<() => void> = [];

  constructor(opts: BeaconOptions) {
    this._startTime = opts.startTime || getZeroTime();
    this._config = opts.config;
    this._logger = opts.logger;
    this._customerId = opts.customerId;
    this._sessionId = opts.sessionId;
    this._pageId = opts.pageId;

    this._maxMeasureTimeout = window.setTimeout(() => {
      this._logger.logEvent(LogEvent.PostBeaconTimeoutReached);
      this._stopRecording();
      this.send();
    }, this._config.maxMeasureTime - msSincePageInit());

    addListener("securitypolicyviolation", (e: SecurityPolicyViolationEvent) => {
      if (
        e.disposition !== "report" &&
        e.blockedURI === this._config.beaconUrlV2 &&
        "URL" in self
      ) {
        // Some websites might have CSP rules that allow the GET beacon, but not the POST beacon.
        // We can detect this here and attempt to send the beacon to a fallback endpoint.
        //
        // If the fallback endpoint has not been provided in the config, we will fall back to using
        // the POST beacon pathname on the GET beacon origin.
        if (!this._config.beaconUrlFallback) {
          const getOrigin = new URL(this._config.beaconUrl).origin;
          const postPathname = new URL(this._config.beaconUrlV2).pathname;
          this._config.beaconUrlFallback = getOrigin + postPathname;
        }

        // Update the V2 beacon URL
        this._config.beaconUrlV2 = this._config.beaconUrlFallback!;
        this._logger.logEvent(LogEvent.PostBeaconCSPViolation, [this._config.beaconUrlV2]);
        this.addFlag(Flags.BeaconBlockedByCsp);

        // Not all browsers return false if sendBeacon fails. In this case, `this.isSent` will be
        // true, even though the beacon wasn't sent. We need to reset this flag to ensure we can
        // retry sending the beacon.
        this.isSent = false;

        // Try to send the beacon again
        if (this._sendRetries < 1) {
          this._sendRetries++;
          this.send();
        }
      }
    });

    this._logger.logEvent(LogEvent.PostBeaconInitialised);
  }

  private _isBeingSampled() {
    const bucket = parseInt(String(this._sessionId).slice(-2));

    return bucket < this._config.samplerate;
  }

  private _stopRecording() {
    this._logger.logEvent(LogEvent.PostBeaconStopRecording);
  }

  addCollector<K extends BeaconMetricKey>(metric: K, collector: CollectorFunction) {
    this._metricCollectors[metric] = collector;
  }

  addFlag(flag: number) {
    this._flags = addFlag(this._flags, flag);
  }

  private _beaconUrl() {
    return this._config.beaconUrlV2;
  }

  onBeforeSend(cb: () => void) {
    this._onBeforeSendCbs[PROPS.push](cb);
  }

  send() {
    if (this.isSent) {
      return;
    }

    this._logger.logEvent(LogEvent.PostBeaconSendCalled);

    for (const cb of this._onBeforeSendCbs) {
      cb();
    }

    if (!this._isBeingSampled()) {
      return;
    }

    const collectionStart = now();
    const metricData: Partial<BeaconMetricData> = {};
    for (const metric in this._metricCollectors) {
      const data = this._metricCollectors[metric as BeaconMetricKey]!(this._config);
      this._logger.logEvent(LogEvent.PostBeaconCollector, [metric, !!data]);
      if (data) {
        metricData[metric as BeaconMetricKey] = data;
      }
    }

    if (!Object.keys(metricData)[PROPS.length] && !this._config.allowEmptyPostBeacon) {
      // TODO: This is only required while the new beacon is supplementary. Once it's the primary
      // beacon, we should send it regardless of how much metric data it has.
      this._logger.logEvent(LogEvent.PostBeaconCancelled);
      return;
    }

    // Only clear the max measure timeout if there's data to send.
    clearTimeout(this._maxMeasureTimeout);

    const beaconUrl = this._beaconUrl();
    const payload: BeaconPayload = Object.assign(
      {
        customerId: this._customerId,
        flags: this._flags,
        measureDuration: msSincePageInit(),
        collectionDuration: now() - collectionStart,
        pageId: this._pageId,
        scriptVersion: VERSION,
        snippetVersion: this._config.snippetVersion,
        sessionId: this._sessionId,
        startTime: this._startTime,
      },
      metricData,
    );

    try {
      if (postJson(beaconUrl, JSON.stringify(payload))) {
        this.isSent = true;
        this._logger.logEvent(LogEvent.PostBeaconSent, [beaconUrl, payload]);
        Events.emit("beacon", payload);
      }
    } catch {
      // Intentionally empty; handled below
    }

    if (!this.isSent) {
      this._logger.logEvent(LogEvent.PostBeaconSendFailed, [beaconUrl, payload]);
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

  /** The lux.js snippet version that sent the beacon */
  snippetVersion?: string;

  /** How long in milliseconds did this beacon capture page data for */
  measureDuration: number;

  /** How long in milliseconds did the collection process take */
  collectionDuration: number;
};

export enum BeaconMetricKey {
  CLS = "cls",
  INP = "inp",
  FCP = "fcp",
  LCP = "lcp",
  LoAF = "loaf",
  RageClick = "rage",
  NavigationTiming = "nt",
}

export type BeaconMetricData = {
  [BeaconMetricKey.NavigationTiming]: NavigationTimingData;
  [BeaconMetricKey.FCP]: MetricWithValue;
  [BeaconMetricKey.LCP]: MetricWithValue & {
    attribution: MetricAttribution | null;

    /** LCP sub-parts can be null if the LCP element was not loaded by a resource */
    subParts: {
      resourceLoadDelay: number;
      resourceLoadTime: number;
      elementRenderDelay: number;
    } | null;
  };

  [BeaconMetricKey.LoAF]: LoAFSummary;

  [BeaconMetricKey.INP]: MetricWithValue & {
    startTime: number;
    duration: number;
    attribution: INPAttribution | null;
    subParts: {
      inputDelay: number;
      processingTime: number;
      presentationDelay: number;
      processingStart: number;
      processingEnd: number;
    };
  };

  [BeaconMetricKey.CLS]: MetricWithValue & {
    startTime: number | null;
    /** Largest entry can be null if there were no layout shifts (value will be 0) */
    largestEntry: {
      value: number;
      startTime: number;
    } | null;
    sources: CLSAttribution[] | null;
  };

  [BeaconMetricKey.RageClick]: MetricWithValue & {
    startTime: number;
    attribution: MetricAttribution;
  };
};

export type CLSAttribution = MetricAttribution & {
  value: number;
  startTime: number;
};

export type INPAttribution = MetricAttribution & {
  eventType: string;
  loafScripts: LoAFScriptSummary[];
};

type MetricWithValue = {
  value: number;
};

export type MetricAttribution = {
  elementSelector: string | null;
  elementType: string | null;
};
