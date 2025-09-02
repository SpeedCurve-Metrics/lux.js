import {
  Beacon,
  BeaconMetricKey,
  CollectorFunction,
  fitUserTimingEntries,
  shouldReportValue,
} from "./beacon";
import onPageLoad from "./beacon-triggers/page-load";
import * as Config from "./config";
import { BOOLEAN_TRUE, END_MARK, START_MARK } from "./constants";
import { SESSION_COOKIE_NAME } from "./cookie";
import * as CustomData from "./custom-data";
import { onVisible, isVisible, wasPrerendered, wasRedirected } from "./document";
import { getNodeSelector } from "./dom";
import * as Events from "./events";
import Flags, { addFlag } from "./flags";
import type { Command, LuxGlobal } from "./global";
import { getTrackingParams } from "./integrations/tracking";
import { InteractionInfo } from "./interaction";
import { addListener, removeListener } from "./listeners";
import Logger, { LogEvent } from "./logger";
import { clamp, floor, max, round, sortNumeric } from "./math";
import * as CLS from "./metric/CLS";
import * as INP from "./metric/INP";
import * as LCP from "./metric/LCP";
import * as LoAF from "./metric/LoAF";
import now from "./now";
import {
  performance,
  timing,
  getEntriesByType,
  navigationType,
  deliveryType,
  getNavigationEntry,
} from "./performance";
import * as PO from "./performance-observer";
import * as ST from "./server-timing";
import scriptStartTime from "./start-marker";
import { padStart } from "./string";
import {
  msSinceNavigationStart,
  msSincePageInit,
  getPageRestoreTime,
  setPageRestoreTime,
  getZeroTime,
  processTimeMetric,
} from "./timing";
import { getMatchesFromPatternMap } from "./url-matcher";
import { VERSION, versionAsFloat } from "./version";

let LUX = (window.LUX as LuxGlobal) || {};
let scriptEndTime = scriptStartTime;

LUX = (function () {
  const logger = new Logger();
  const globalConfig = Config.fromObject(LUX);

  logger.logEvent(LogEvent.EvaluationStart, [VERSION, JSON.stringify(globalConfig)]);

  // Variable aliases that allow the minifier to reduce file size.
  const document = window.document;
  const addEventListener = window.addEventListener;
  const removeEventListener = window.removeEventListener;
  const setTimeout = window.setTimeout;
  const clearTimeout = window.clearTimeout;
  const encodeURIComponent = window.encodeURIComponent;
  const thisScript = (document.currentScript as HTMLScriptElement) || {};

  // Log JS errors.
  let nErrors = 0;
  function errorHandler(e: ErrorEvent): void {
    if (!globalConfig.trackErrors) {
      return;
    }

    nErrors++;

    if (e && typeof e.filename !== "undefined" && typeof e.message !== "undefined") {
      // Always send LUX errors
      const isLuxError = e.filename.indexOf("/lux.js?") > -1 || e.message.indexOf("LUX") > -1;

      if (isLuxError || (nErrors <= globalConfig.maxErrors && _sample())) {
        // Sample & limit other errors.
        // Send the error beacon.
        new Image().src =
          globalConfig.errorBeaconUrl +
          "?v=" +
          versionAsFloat() +
          "&id=" +
          getCustomerId() +
          "&fn=" +
          encodeURIComponent(e.filename) +
          "&ln=" +
          e.lineno +
          "&cn=" +
          e.colno +
          "&msg=" +
          encodeURIComponent(e.message) +
          "&l=" +
          encodeURIComponent(_getPageLabel()) +
          (connectionType() ? "&ct=" + connectionType() : "") +
          "&HN=" +
          encodeURIComponent(document.location.hostname) +
          "&PN=" +
          encodeURIComponent(document.location.pathname);
      }
    }
  }
  addEventListener("error", errorHandler);

  // Bitmask of flags for this session & page
  let gFlags = 0;

  const gaMarks: PerformanceEntryList = [];
  const gaMeasures: PerformanceEntryList = [];
  let ghIx: InteractionInfo = {}; // hash for Interaction Metrics (scroll, click, keyboard)
  let gbLuxSent = 0; // have we sent the LUX data? (avoid sending twice in unload)
  let gbNavSent = 0; // have we sent the Nav Timing beacon yet? (avoid sending twice for SPA)
  let gbIxSent = 0; // have we sent the IX data? (avoid sending twice for SPA)
  let gbFirstPV = 1; // this is the first page view (vs. a SPA "soft nav")
  const gSessionTimeout = 30 * 60; // number of seconds after which we consider a session to have "timed out" (used for calculating bouncerate)
  let gSyncId = createSyncId(); // if we send multiple beacons, use this to sync them (eg, LUX & IX) (also called "luxid")
  let gUid = refreshUniqueId(gSyncId); // cookie for this session ("Unique ID")
  let gCustomDataTimeout: number | undefined; // setTimeout timer for sending a Custom data beacon after onload
  let gMaxMeasureTimeout: number | undefined; // setTimeout timer for sending the beacon after a maximum measurement time

  // Storing the customer ID in a local variable makes it possible to run multiple instances of lux.js
  // on the same page.
  let _thisCustomerId = LUX.customerid;

  const beaconCollectors: [BeaconMetricKey, CollectorFunction][] = [];

  const logEntry = <T extends PerformanceEntry>(entry: T) => {
    logger.logEvent(LogEvent.PerformanceEntryReceived, [entry]);
  };

  // Most PerformanceEntry types we log an event for and add it to the global entry store.
  const processAndLogEntry = <T extends PerformanceEntry>(entry: T) => {
    PO.addEntry(entry);
    logEntry(entry);
  };

  try {
    PO.observe("longtask", processAndLogEntry);
    PO.observe("element", processAndLogEntry);
    PO.observe("paint", processAndLogEntry);

    if (
      PO.observe("largest-contentful-paint", (entry) => {
        // Process the LCP entry for the legacy beacon
        processAndLogEntry(entry);

        // Process the LCP entry for the new beacon
        LCP.processEntry(entry);
      })
    ) {
      beaconCollectors.push([BeaconMetricKey.LCP, LCP.getData]);
    }

    if (
      PO.observe("layout-shift", (entry) => {
        CLS.processEntry(entry);
        logEntry(entry);
      })
    ) {
      beaconCollectors.push([BeaconMetricKey.CLS, CLS.getData]);
    }

    if (
      PO.observe("long-animation-frame", (entry) => {
        LoAF.processEntry(entry);
        logEntry(entry);
      })
    ) {
      beaconCollectors.push([BeaconMetricKey.LoAF, LoAF.getData]);
    }

    const handleINPEntry = (entry: PerformanceEventTiming) => {
      INP.processEntry(entry);
      logEntry(entry);
    };

    PO.observe("first-input", (entry) => {
      logEntry(entry);

      const entryTime = (entry as PerformanceEventTiming).processingStart - entry.startTime;

      if (!gFirstInputDelay || gFirstInputDelay < entryTime) {
        gFirstInputDelay = floor(entryTime);
      }

      // Allow first-input events to be considered for INP
      handleINPEntry(entry);
    });

    // TODO: Set durationThreshold to 40 once performance.interactionCount is widely supported.
    // Right now we have to count every event to get the total interaction count so that we can
    // estimate a high percentile value for INP.
    if (
      PO.observe(
        "event",
        (entry: PerformanceEventTiming) => {
          handleINPEntry(entry);

          // It's useful to log the interactionId, but it is not serialised by default. Annoyingly, we
          // need to manually serialize our own object with the keys we want.
          logEntry({
            interactionId: entry.interactionId,
            name: entry.name,
            entryType: entry.entryType,
            startTime: entry.startTime,
            duration: entry.duration,
            processingStart: entry.processingStart,
            processingEnd: entry.processingEnd,
          } as PerformanceEventTiming);
        },
        { durationThreshold: 0 },
      )
    ) {
      beaconCollectors.push([BeaconMetricKey.INP, INP.getData]);
    }
  } catch (e) {
    logger.logEvent(LogEvent.PerformanceObserverError, [e]);
  }

  const initPostBeacon = () => {
    const b = new Beacon({
      config: globalConfig,
      logger,
      customerId: getCustomerId(),
      sessionId: gUid,
      pageId: gSyncId,
    });

    beaconCollectors.forEach(([metric, collector]) => {
      b.addCollector(metric, collector);
    });

    return b;
  };

  let beacon = initPostBeacon();

  if (_sample()) {
    logger.logEvent(LogEvent.SessionIsSampled, [globalConfig.samplerate]);
  } else {
    logger.logEvent(LogEvent.SessionIsNotSampled, [globalConfig.samplerate]);
  }

  const gLuxSnippetStart = LUX.ns ? LUX.ns - timing.navigationStart : 0;

  if (!performance.timing) {
    logger.logEvent(LogEvent.NavTimingNotSupported);
    gFlags = addFlag(gFlags, Flags.NavTimingNotSupported);
    beacon.addFlag(Flags.NavTimingNotSupported);
  }

  logger.logEvent(LogEvent.NavigationStart, [timing.navigationStart]);

  ////////////////////// FID BEGIN
  // FIRST INPUT DELAY (FID)
  // The basic idea behind FID is to attach various input event listeners and measure the time
  // between when the event happens and when the handler executes. That is FID.
  let gFirstInputDelay: number | undefined;
  const gaEventTypes = ["click", "mousedown", "keydown", "touchstart", "pointerdown"]; // NOTE: does NOT include scroll!
  const ghListenerOptions = { passive: true, capture: true };

  // Record the FIRST input delay.
  function recordDelay(delay: number) {
    if (!gFirstInputDelay) {
      gFirstInputDelay = floor(delay);

      // remove event listeners
      gaEventTypes.forEach(function (eventType) {
        removeEventListener(eventType, onInput, ghListenerOptions);
      });
    }
  }

  // Pointer events are special. Ignore scrolling by looking for pointercancel
  // events because FID does not include scrolling nor pinch/zooming.
  function onPointerDown(delay: number) {
    function onPointerUp() {
      recordDelay(delay);
      removeListeners();
    }

    // Do NOT record FID - this is a scroll.
    function onPointerCancel() {
      removeListeners();
    }

    function removeListeners() {
      removeEventListener("pointerup", onPointerUp, ghListenerOptions);
      removeEventListener("pointercancel", onPointerCancel, ghListenerOptions);
    }

    addEventListener("pointerup", onPointerUp, ghListenerOptions);
    addEventListener("pointercancel", onPointerCancel, ghListenerOptions);
  }

  // Record FID as the delta between when the event happened and when the
  // listener was able to execute.
  function onInput(evt: Event): void {
    let bCancelable = false;
    try {
      // Seeing "Permission denied" errors, so do a simple try-catch.
      bCancelable = evt.cancelable;
    } catch (e) {
      // bail - no need to return anything
      logger.logEvent(LogEvent.InputEventPermissionError);
      return;
    }

    if (bCancelable) {
      let now = msSinceNavigationStart();
      const eventTimeStamp = evt.timeStamp;

      if (eventTimeStamp > 1520000000) {
        // If the event timeStamp is an epoch time instead of a time relative to NavigationStart,
        // then compare it to Date.now() instead of performance.now().
        now = Number(new Date());
      }
      if (eventTimeStamp > now) {
        // If there is a race condition and eventTimeStamp happened after
        // this code was executed, something is wrong. Bail.
        return;
      }

      const delay = now - eventTimeStamp;

      if (evt.type === "pointerdown") {
        // special case
        onPointerDown(delay);
      } else {
        recordDelay(delay);
      }
    }
  }

  // Attach event listener to input events.
  gaEventTypes.forEach(function (eventType) {
    addEventListener(eventType, onInput, ghListenerOptions);
  });
  ////////////////////// FID END

  // This is a wrapper around performance.mark that falls back to a polyfill when the User Timing
  // API isn't supported.
  function _mark(
    ...args: Parameters<LuxGlobal["mark"]>
  ): ReturnType<LuxGlobal["mark"]> | undefined {
    logger.logEvent(LogEvent.MarkCalled, args);

    if (performance.mark) {
      // Use the native performance.mark where possible...
      return performance.mark(...args);
    }

    // ...Otherwise provide a polyfill
    if (__ENABLE_POLYFILLS) {
      const name = args[0];
      const detail = args[1]?.detail || null;
      const startTime = args[1]?.startTime || msSincePageInit();

      const entry = {
        entryType: "mark",
        duration: 0,
        name,
        detail,
        startTime,
      } as PerformanceMark;

      gaMarks.push(entry);
      gFlags = addFlag(gFlags, Flags.UserTimingNotSupported);
      beacon.addFlag(Flags.UserTimingNotSupported);

      return entry;
    }
  }

  // This is a wrapper around performance.measure that falls back to a polyfill when the User Timing
  // API isn't supported.
  function _measure(...args: Parameters<LuxGlobal["measure"]>): ReturnType<LuxGlobal["measure"]> {
    logger.logEvent(LogEvent.MeasureCalled, args);

    const name = args[0];
    let startMarkName = args[1] as string | number;
    let endMarkName = args[2] as string | number;
    let options;

    if (typeof startMarkName === "object") {
      options = args[1] as PerformanceMeasureOptions;
      startMarkName = options.start as string | number;
      endMarkName = options.end as string | number;
    }

    if (typeof startMarkName === "undefined") {
      // Without a start mark specified, performance.measure defaults to using navigationStart
      if (_getMark(START_MARK)) {
        // For SPAs that have already called LUX.init(), we use our internal start mark instead of
        // navigationStart
        startMarkName = START_MARK;
      } else {
        // For regular page views, we need to patch the navigationStart behaviour because IE11 throws
        // a SyntaxError without a start mark
        startMarkName = "navigationStart";
      }

      // Since we've potentially modified the start mark, we need to shove it back into whichever
      // argument it belongs in.
      if (options) {
        // If options were provided, we need to avoid specifying a start mark if an end mark and
        // duration were already specified.
        if (!options.end || !options.duration) {
          (args[1] as PerformanceMeasureOptions).start = startMarkName;
        }
      } else {
        args[1] = startMarkName;
      }
    }

    if (performance.measure) {
      // Use the native performance.measure where possible...
      return performance.measure(...args);
    }

    // ...Otherwise provide a polyfill
    if (__ENABLE_POLYFILLS) {
      const navEntry = getNavigationEntry();
      let startTime = typeof startMarkName === "number" ? startMarkName : 0;
      let endTime = typeof endMarkName === "number" ? endMarkName : msSincePageInit();
      const throwError = (missingMark: string) => {
        throw new DOMException(
          "Failed to execute 'measure' on 'Performance': The mark '" +
            missingMark +
            "' does not exist",
        );
      };

      if (typeof startMarkName === "string") {
        const startMark = _getMark(startMarkName);
        if (startMark) {
          startTime = startMark.startTime;
        } else if (typeof navEntry[startMarkName] === "number") {
          // the mark name can also be a property from Navigation Timing
          startTime = navEntry[startMarkName] as number;
        } else {
          throwError(startMarkName);
        }
      }

      if (typeof endMarkName === "string") {
        const endMark = _getMark(endMarkName);
        if (endMark) {
          endTime = endMark.startTime;
        } else if (typeof navEntry[endMarkName] === "number") {
          // the mark name can also be a property from Navigation Timing
          endTime = navEntry[endMarkName] as number;
        } else {
          throwError(endMarkName);
        }
      }

      let duration = endTime - startTime;
      let detail = null;

      if (options) {
        if (options.duration) {
          duration = options.duration;
        }

        detail = options.detail;
      }

      const entry = {
        entryType: "measure",
        name,
        detail,
        startTime,
        duration,
      } as PerformanceMeasure;

      gaMeasures.push(entry);
      gFlags = addFlag(gFlags, Flags.UserTimingNotSupported);
      beacon.addFlag(Flags.UserTimingNotSupported);

      return entry;
    }
  }

  // Return THE LAST mark that matches the name.
  function _getMark(name: string): PerformanceEntry | undefined {
    return _getM<PerformanceEntry>(name, _getMarks());
  }

  function _getM<T extends { name: string }>(name: string, aItems: T[]): T | undefined {
    if (aItems) {
      for (let i = aItems.length - 1; i >= 0; i--) {
        const m = aItems[i];
        if (name === m.name) {
          return m;
        }
      }
    }

    return undefined;
  }

  // Return an array of marks.
  function _getMarks(): PerformanceEntryList {
    const marks = getEntriesByType("mark");

    if (marks.length) {
      return marks;
    }

    return gaMarks;
  }

  // Return an array of measures.
  function _getMeasures(): PerformanceEntryList {
    const measures = getEntriesByType("measure");

    if (measures.length) {
      return measures;
    }

    return gaMeasures;
  }

  interface UserTimingEntry {
    startTime: number;
    duration?: number;
  }

  // Return a string of User Timing Metrics formatted for beacon querystring.
  function userTimingValues(): string[] {
    // The User Timing spec allows for there to be multiple marks with the same name,
    // and multiple measures with the same name. But we can only send back one value
    // for a name, so we always take the maximum value.
    const hUT: Record<string, UserTimingEntry> = {};
    const startMark = _getMark(START_MARK);

    // For user timing values taken in a SPA page load, we need to adjust them
    // so that they're zeroed against the last LUX.init() call.
    const tZero = getZeroTime();

    // marks
    _getMarks().forEach((mark) => {
      const name = mark.name;

      if (name === START_MARK || name === END_MARK) {
        // Don't include the internal marks in the beacon
        return;
      }

      const startTime = floor(mark.startTime - tZero);

      if (startTime < 0) {
        // Exclude marks that were taken before the current SPA page view
        return;
      }

      if (typeof hUT[name] === "undefined") {
        hUT[name] = { startTime };
      } else {
        hUT[name].startTime = max(startTime, hUT[name].startTime);
      }
    });

    // measures
    _getMeasures().forEach((measure) => {
      if (startMark && measure.startTime < startMark.startTime) {
        // Exclude measures that were taken before the current SPA page view
        return;
      }

      const name = measure.name;
      const startTime = floor(measure.startTime - tZero);
      const duration = floor(measure.duration);

      if (typeof hUT[name] === "undefined" || startTime > hUT[name].startTime) {
        hUT[name] = { startTime, duration };
      }
    });

    // Convert the user timing values into a delimited string. This string takes the format
    // markName|startTime,measureName|startTime|duration,[markName...]
    const aUT: string[] = [];

    for (const utName in hUT) {
      const { startTime, duration } = hUT[utName];
      const utParts = [utName, startTime];

      if (typeof duration !== "undefined") {
        utParts.push(duration);
      }

      aUT.push(utParts.join("|"));
    }

    return aUT;
  }

  // Return a string of Element Timing Metrics formatted for beacon querystring.
  function elementTimingValues(): string {
    const aET: string[] = [];

    PO.getEntries("element").forEach((entry) => {
      if (entry.identifier && entry.startTime) {
        const value = processTimeMetric(entry.startTime);

        if (shouldReportValue(value)) {
          logger.logEvent(LogEvent.PerformanceEntryProcessed, [entry]);
          aET.push(entry.identifier + "|" + value);
        }
      }
    });

    return aET.join(",");
  }

  // Return a string of CPU times formatted for beacon querystring.
  function cpuTimes() {
    if (!("PerformanceLongTaskTiming" in self)) {
      // Do not return any CPU metrics if Long Tasks API is not supported.
      return "";
    }

    let sCPU = "";
    const hCPU: Record<string, number> = {};
    const hCPUDetails: Record<string, string> = {}; // TODO - Could remove this later after large totals go away.
    const longTaskEntries = PO.getEntries("longtask");

    // Add up totals for each "type" of long task
    if (longTaskEntries.length) {
      const tZero = getZeroTime();

      longTaskEntries.forEach((entry) => {
        let dur = floor(entry.duration);
        if (entry.startTime < tZero) {
          // In a SPA it is possible that we were in the middle of a Long Task when
          // LUX.init() was called. If so, only include the duration after tZero.
          dur -= tZero - entry.startTime;
        }

        // Only process entries that we calculated to have a valid duration
        if (dur > 0) {
          logger.logEvent(LogEvent.PerformanceEntryProcessed, [entry]);

          const type = entry.attribution[0].name;

          if (!hCPU[type]) {
            hCPU[type] = 0;
            hCPUDetails[type] = "";
          }

          hCPU[type] += dur;
          // Send back the raw startTime and duration, as well as the adjusted duration.
          hCPUDetails[type] += "," + floor(entry.startTime) + "|" + dur;
        }
      });
    }

    // TODO - Add more types if/when they become available.
    const jsType = typeof hCPU["script"] !== "undefined" ? "script" : "unknown"; // spec changed from "script" to "unknown" Nov 2018
    if (typeof hCPU[jsType] === "undefined") {
      // Initialize default values for pages that have *no Long Tasks*.
      hCPU[jsType] = 0;
      hCPUDetails[jsType] = "";
    }

    const hStats = cpuStats(hCPUDetails[jsType]);
    const sStats =
      ",n|" +
      hStats.count +
      ",d|" +
      hStats.median +
      ",x|" +
      hStats.max +
      (typeof hStats.fci === "undefined" ? "" : ",i|" + hStats.fci);
    sCPU += "s|" + hCPU[jsType] + sStats + hCPUDetails[jsType];

    return sCPU;
  }

  // Return a hash of "stats" about the CPU details incl. count, max, and median.
  function cpuStats(sDetails: string) {
    // tuples of starttime|duration, eg: ,456|250,789|250,1012|250
    let max = 0;

    // FCI is beginning of 5 second window of no Long Tasks _after_ first contentful paint
    const fcp = getFcp();
    let fci = fcp || 0;

    // If FCP is not supported, we can't calculate a valid FCI.
    let bFoundFci = typeof fcp === "undefined";
    const aValues = [];
    const aTuples = sDetails.split(",");

    for (let i = 0; i < aTuples.length; i++) {
      const aTuple = aTuples[i].split("|");
      if (aTuple.length === 2) {
        const start = parseInt(aTuple[0]);
        const dur = parseInt(aTuple[1]);
        aValues.push(dur);
        max = dur > max ? dur : max;

        // FCI
        if (!bFoundFci && start > fci) {
          // should always be true (assumes Long Tasks are in chrono order)
          if (start - fci > 5000) {
            // More than 5 seconds of inactivity!
            // FCI is the previous value we set (eg, FCI or the _end_ of the previous Long Task)
            bFoundFci = true;
          } else {
            // Less than 5 seconds of inactivity
            const val = processTimeMetric(start + dur);

            if (shouldReportValue(val)) {
              fci = val; // FCI is now the end of this Long Task
            }
          }
        }
      }
    }

    const count = aValues.length;
    const median = arrayMedian(aValues);

    return { count, median, max, fci };
  }

  // Return the median value from an array of integers.
  function arrayMedian(aValues: number[]): number {
    if (0 === aValues.length) {
      return 0;
    }

    const half = floor(aValues.length / 2);
    aValues.sort(sortNumeric);

    if (aValues.length % 2) {
      // Return the middle value.
      return aValues[half];
    } else {
      // Return the average of the two middle values.
      return round((aValues[half - 1] + aValues[half]) / 2.0);
    }
  }

  // Track how long it took lux.js to load via Resource Timing.
  function selfLoading(): string {
    let sLuxjs = "";
    if (gbFirstPV && performance.getEntriesByName) {
      // Get the lux script URL (including querystring params).
      const aResources = performance.getEntriesByName(thisScript.src);
      if (aResources && aResources.length) {
        const r = aResources[0] as PerformanceResourceTiming;
        // DO NOT USE DURATION!!!!!
        // See https://www.stevesouders.com/blog/2014/11/25/serious-confusion-with-resource-timing/
        const dns = floor(r.domainLookupEnd - r.domainLookupStart);
        const tcp = floor(r.connectEnd - r.connectStart);
        const fb = floor(r.responseStart - r.requestStart);
        const content = floor(r.responseEnd - r.responseStart);
        const networkDuration = dns + tcp + fb + content;
        const parseEval = scriptEndTime - scriptStartTime;
        const transferSize = r.encodedBodySize ? r.encodedBodySize : 0;
        // Instead of a delimiter use a 1-letter abbreviation as a separator.
        sLuxjs =
          "d" +
          dns +
          "t" +
          tcp +
          "f" +
          fb +
          "c" +
          content +
          "n" +
          networkDuration +
          "e" +
          parseEval +
          "r" +
          globalConfig.samplerate + // sample rate
          (typeof transferSize === "number" ? "x" + transferSize : "") +
          (typeof gLuxSnippetStart === "number" ? "l" + gLuxSnippetStart : "") +
          "s" +
          (scriptStartTime - timing.navigationStart) + // when lux.js started getting evaluated relative to navigationStart
          "";
      }
    }

    // How long data was collected before the beacon was sent
    sLuxjs += "m" + msSincePageInit();

    return sLuxjs;
  }

  // _clearIx
  function _clearIx() {
    ghIx = {};
  }

  // Return a string of Interaction Metrics formatted for beacon querystring.
  function ixValues(): string {
    const aIx = [];
    for (const key in ghIx) {
      aIx.push(key + "|" + encodeURIComponent(ghIx[key as keyof InteractionInfo]!));
    }

    return aIx.join(",");
  }

  function _addData(name: unknown, value: unknown) {
    logger.logEvent(LogEvent.AddDataCalled, [name, value]);

    if (typeof name === "string") {
      CustomData.addCustomDataValue(name, value);
    }

    if (gbLuxSent) {
      // This is special: We want to allow customers to call LUX.addData()
      // _after_ window.onload. So we have to send a Custom data beacon that
      // includes the new custom data.
      // Do setTimeout so that if there are multiple back-to-back addData calls
      // we get them all in one beacon.
      if (gCustomDataTimeout) {
        // Cancel the timer for any previous beacons so that if they have not
        // yet been sent we can combine all the data in a new beacon.
        clearTimeout(gCustomDataTimeout);
      }

      gCustomDataTimeout = setTimeout(_sendCustomData, 100);
    }
  }

  // _sample()
  // Return true if beacons for this page should be sampled.
  function _sample() {
    if (typeof gUid === "undefined" || typeof globalConfig.samplerate === "undefined") {
      return false; // bail
    }

    const nThis = ("" + gUid).substr(-2); // number for THIS page - from 00 to 99
    return parseInt(nThis) < globalConfig.samplerate;
  }

  /**
   * Re-initialize lux.js to start a new "page". This is typically called within a SPA at the
   * beginning of a page transition, but is also called internally when the BF cache is restored.
   */
  function _init(startTime?: number, clearFlags = true): void {
    // Mark the "navigationStart" for this SPA page. A start time can be passed through, for example
    // to set a page's start time as an event timestamp.
    if (startTime) {
      _mark(START_MARK, { startTime });
    } else {
      _mark(START_MARK);
    }

    // Clear all interactions from the previous "page".
    _clearIx();

    // Since we actively disable IX handlers, we re-add them each time.
    _removeIxHandlers();
    _addIxHandlers();

    // Reset a bunch of flags.
    gbNavSent = 0;
    gbLuxSent = 0;
    gbIxSent = 0;
    gbFirstPV = 0;
    gSyncId = createSyncId();
    gUid = refreshUniqueId(gSyncId);
    LCP.reset();
    CLS.reset();
    INP.reset();
    LoAF.reset();
    nErrors = 0;
    gFirstInputDelay = undefined;

    beacon = initPostBeacon();

    // Clear flags then set the flag that init was called (ie, this is a SPA).
    if (clearFlags) {
      gFlags = 0;
      gFlags = addFlag(gFlags, Flags.InitCalled);
      beacon.addFlag(Flags.InitCalled);
    }

    // Reset the maximum measure timeout
    createMaxMeasureTimeout();
  }

  // Return the number of blocking (synchronous) external scripts in the page.
  function blockingScripts() {
    const lastViewportElem = lastViewportElement();
    if (!lastViewportElem) {
      // If we can not find the last DOM element in the viewport,
      // use the old technique of just counting sync scripts.
      return syncScripts();
    }

    // Find all the synchronous scripts that are ABOVE the last DOM element in the
    // viewport. (If they are BELOW then they do not block rendering of initial viewport.)
    const aElems = document.getElementsByTagName("script");
    let num = 0;
    for (let i = 0, len = aElems.length; i < len; i++) {
      const e = aElems[i];
      if (
        e.src &&
        !e.async &&
        !e.defer &&
        0 !== (e.compareDocumentPosition(lastViewportElem) & 4)
      ) {
        // If the script has a SRC and async is false and it occurs BEFORE the last viewport element,
        // then increment the counter.
        num++;
      }
    }

    return num;
  }

  // Return the number of blocking (synchronous) external scripts in the page.
  function blockingStylesheets() {
    let nBlocking = 0;
    const aElems = document.getElementsByTagName("link");
    for (let i = 0, len = aElems.length; i < len; i++) {
      const e = aElems[i];
      if (e.href && "stylesheet" === e.rel && 0 !== e.href.indexOf("data:")) {
        if (
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (e as any).onloadcssdefined ||
          "print" === e.media ||
          "style" === e.as ||
          (typeof e.onload === "function" && e.media === "all")
        ) {
          // Not blocking
        } else {
          nBlocking++;
        }
      }
    }
    return nBlocking;
  }

  // Return the number of synchronous external scripts in the page.
  function syncScripts() {
    const aElems = document.getElementsByTagName("script");
    let num = 0;
    for (let i = 0, len = aElems.length; i < len; i++) {
      const e = aElems[i];
      if (e.src && !e.async && !e.defer) {
        // If the script has a SRC and async is false, then increment the counter.
        num++;
      }
    }

    return num;
  }

  // Return the number of external scripts in the page.
  function numScripts() {
    const aElems = document.getElementsByTagName("script");
    let num = 0;
    for (let i = 0, len = aElems.length; i < len; i++) {
      const e = aElems[i];
      if (e.src) {
        num++;
      }
    }
    return num;
  }

  // Return the number of stylesheets in the page.
  function numStylesheets() {
    const aElems = document.getElementsByTagName("link");
    let num = 0;
    for (let i = 0, len = aElems.length; i < len; i++) {
      const e = aElems[i];
      if (e.href && "stylesheet" == e.rel) {
        num++;
      }
    }
    return num;
  }

  function inlineTagSize(tagName: string) {
    const aElems = document.getElementsByTagName(tagName);
    let size = 0;
    for (let i = 0, len = aElems.length; i < len; i++) {
      const e = aElems[i];
      try {
        size += e.innerHTML.length;
      } catch (e) {
        // It seems like IE throws an error when accessing the innerHTML property
        logger.logEvent(LogEvent.InnerHtmlAccessError);
        return -1;
      }
    }

    return size;
  }

  function getNavTiming() {
    let s = "";
    let ns = timing.navigationStart;
    const startMark = _getMark(START_MARK);
    const endMark = _getMark(END_MARK);
    if (startMark && endMark && !getPageRestoreTime()) {
      // This is a SPA page view, so send the SPA marks & measures instead of Nav Timing.
      // Note: getPageRestoreTime() indicates this was a bfcache restore, which we don't want to treat as a SPA.
      const start = floor(startMark.startTime); // the start mark is "zero"
      ns += start; // "navigationStart" for a SPA is the real navigationStart plus the start mark
      const end = floor(endMark.startTime) - start; // delta from start mark
      s =
        ns +
        // fetchStart and activationStart are the same as navigationStart for a SPA
        "as" +
        0 +
        "fs" +
        0 +
        (end > 0 ? "ls" + end + "le" + end : "");
    } else if (performance.timing) {
      // Return the real Nav Timing metrics because this is the "main" page view (not a SPA)
      const navEntry = getNavigationEntry();
      const startRender = getStartRender();
      const fcp = getFcp();
      const lcp = getLcp();

      const prefixNTValue = (
        key: keyof PerformanceNavigationTiming,
        prefix: string,
        ignoreZero?: boolean,
      ): string => {
        if (typeof navEntry[key] === "number") {
          const value = navEntry[key] as number;

          // We allow zero values for most navigation timing metrics, but for some metrics we want
          // to ignore zeroes. The exceptions are that all metrics can be zero if the page was either
          // prerendered or restored from the BF cache.
          if (shouldReportValue(value) || !ignoreZero) {
            return prefix + processTimeMetric(value);
          }
        }

        return "";
      };

      // loadEventStart always comes from navigation timing
      let loadEventStartStr = prefixNTValue("loadEventStart", "ls", true);

      // If LUX.markLoadTime() was called in SPA Mode, we allow the custom mark to override loadEventEnd
      let loadEventEndStr =
        globalConfig.spaMode && endMark
          ? "le" + processTimeMetric(endMark.startTime)
          : prefixNTValue("loadEventEnd", "le", true);

      if (getPageRestoreTime() && startMark && endMark) {
        // For bfcache restores, we set the load time to the time it took for the page to be restored.
        const loadTime = floor(endMark.startTime - startMark.startTime);
        loadEventStartStr = "ls" + loadTime;
        loadEventEndStr = "le" + loadTime;
      }

      const redirect = wasRedirected();
      const isSecure = document.location.protocol === "https:";

      s = [
        ns,
        "as" + clamp(navEntry.activationStart),
        redirect && !getPageRestoreTime() ? prefixNTValue("redirectStart", "rs") : "",
        redirect && !getPageRestoreTime() ? prefixNTValue("redirectEnd", "re") : "",
        prefixNTValue("fetchStart", "fs"),
        prefixNTValue("domainLookupStart", "ds"),
        prefixNTValue("domainLookupEnd", "de"),
        prefixNTValue("connectStart", "cs"),
        isSecure ? prefixNTValue("secureConnectionStart", "sc") : "",
        prefixNTValue("connectEnd", "ce"),
        prefixNTValue("requestStart", "qs"),
        prefixNTValue("responseStart", "bs"),
        prefixNTValue("responseEnd", "be"),
        prefixNTValue("domInteractive", "oi", true),
        prefixNTValue("domContentLoadedEventStart", "os", true),
        prefixNTValue("domContentLoadedEventEnd", "oe", true),
        prefixNTValue("domComplete", "oc", true),
        loadEventStartStr,
        loadEventEndStr,
        typeof startRender !== "undefined" ? "sr" + startRender : "",
        typeof fcp !== "undefined" ? "fc" + fcp : "",
        typeof lcp !== "undefined" ? "lc" + lcp : "",
      ].join("");
    } else if (endMark) {
      // This is a "main" page view that does NOT support Navigation Timing - strange.
      const end = floor(endMark.startTime);
      s =
        ns +
        "fs" +
        0 + // fetchStart is the same as navigationStart
        "ls" +
        end +
        "le" +
        end +
        "";
    }

    return s;
  }

  // Return First Contentful Paint or undefined if not supported.
  function getFcp(): number | undefined {
    const paintEntries = getEntriesByType("paint");

    for (let i = 0; i < paintEntries.length; i++) {
      const entry = paintEntries[i];

      if (entry.name === "first-contentful-paint") {
        const value = processTimeMetric(entry.startTime);

        if (shouldReportValue(value)) {
          return value;
        }
      }
    }

    return undefined;
  }

  // Return Largest Contentful Paint or undefined if not supported.
  function getLcp(): number | undefined {
    const lcpEntries = PO.getEntries("largest-contentful-paint");

    if (lcpEntries.length) {
      const lastEntry = lcpEntries[lcpEntries.length - 1];
      const value = processTimeMetric(lastEntry.startTime);

      if (shouldReportValue(value)) {
        logger.logEvent(LogEvent.PerformanceEntryProcessed, [lastEntry]);
        return value;
      }
    }

    return undefined;
  }

  // Return best guess at Start Render time (in ms).
  // Mostly works on just Chrome and IE.
  // Return undefined if not supported.
  function getStartRender(): number | undefined {
    if ("PerformancePaintTiming" in self) {
      const paintEntries = getEntriesByType("paint");

      if (paintEntries.length) {
        const paintValues = paintEntries.map((entry) => entry.startTime).sort(sortNumeric);

        // Use the earliest valid paint entry as the start render time.
        for (let i = 0; i < paintValues.length; i++) {
          const value = processTimeMetric(paintValues[i]);

          if (shouldReportValue(value)) {
            return value;
          }
        }
      }
    }

    if (performance.timing && timing.msFirstPaint && __ENABLE_POLYFILLS) {
      // If IE/Edge, use the prefixed `msFirstPaint` property (see http://msdn.microsoft.com/ff974719).
      return floor(timing.msFirstPaint - timing.navigationStart);
    }

    logger.logEvent(LogEvent.PaintTimingNotSupported);

    return undefined;
  }

  function getINPDetails(): INP.Interaction | undefined {
    if (!("PerformanceEventTiming" in self)) {
      return undefined;
    }

    return INP.getHighPercentileInteraction();
  }

  /**
   * Build the query string for the INP parameters:
   *
   * - INP: The duration of the P98 interaction
   * - INPs: The selector of the P98 interaction element
   * - INPt: The timestamp of the P98 interaction start time
   * - INPi: The input delay subpart of the P98 interaction
   * - INPp: The processing time subpart of the P98 interaction
   * - INPd: The presentation delay subpart of the P98 interaction
   */
  function getINPString(details: INP.Interaction): string {
    return [
      "&INP=" + details.duration,
      details.selector ? "&INPs=" + encodeURIComponent(details.selector) : "",
      "&INPt=" + floor(details.startTime),
      "&INPi=" + clamp(floor(details.processingStart - details.startTime)),
      "&INPp=" + clamp(floor(details.processingTime)),
      "&INPd=" + clamp(floor(details.startTime + details.duration - details.processingEnd)),
    ].join("");
  }

  function getCustomerId() {
    if (!_thisCustomerId) {
      _thisCustomerId = thisScript.src.match(/id=(\d+)/)!.pop();
    }

    if (!_thisCustomerId) {
      return "";
    }

    return String(_thisCustomerId);
  }

  function avgDomDepth() {
    const aElems = document.getElementsByTagName("*");
    let i = aElems.length;
    let totalParents = 0;
    while (i--) {
      totalParents += numParents(aElems[i]);
    }
    const average = round(totalParents / aElems.length);
    return average;
  }

  function numParents(elem: Node) {
    let n = 0;
    if (elem.parentNode) {
      while ((elem = elem.parentNode)) {
        n++;
      }
    }
    return n;
  }

  function docHeight(doc: Document) {
    const body = doc.body,
      docelem = doc.documentElement;
    const height = max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      docelem ? docelem.clientHeight : 0,
      docelem ? docelem.scrollHeight : 0,
      docelem ? docelem.offsetHeight : 0,
    );
    return height;
  }

  function docWidth(doc: Document) {
    const body = doc.body,
      docelem = doc.documentElement;
    const width = max(
      body ? body.scrollWidth : 0,
      body ? body.offsetWidth : 0,
      docelem ? docelem.clientWidth : 0,
      docelem ? docelem.scrollWidth : 0,
      docelem ? docelem.offsetWidth : 0,
    );
    return width;
  }

  // Return the main HTML document transfer size (in bytes).
  function docSize(): number {
    return getNavigationEntry().encodedBodySize || 0;
  }

  // Return the connection type based on Network Information API.
  // Note this API is in flux.
  function connectionType() {
    const c = navigator.connection;
    let connType = "";

    if (c && c.effectiveType) {
      connType = c.effectiveType;

      if ("slow-2g" === connType) {
        connType = "Slow 2G";
      } else if ("2g" === connType || "3g" === connType || "4g" === connType || "5g" === connType) {
        connType = connType.toUpperCase();
      } else {
        connType = connType.charAt(0).toUpperCase() + connType.slice(1);
      }
    }

    return connType;
  }

  // Return an array of image elements that are in the top viewport.
  function imagesATF() {
    const aImages = document.getElementsByTagName("img");
    const aImagesAtf = [];
    if (aImages) {
      for (let i = 0, len = aImages.length; i < len; i++) {
        const image = aImages[i];
        if (inViewport(image)) {
          aImagesAtf.push(image);
        }
      }
    }

    return aImagesAtf;
  }

  // Return the last element in the viewport.
  function lastViewportElement(parent?: Element): Element | undefined {
    if (!parent) {
      // We call this function recursively passing in the parent element,
      // but if no parent then start with BODY.
      parent = document.body;
    }

    let lastChildInViewport;
    if (parent) {
      // Got errors that parent was null so testing again here.
      // Find the last child that is in the viewport.
      // Elements are listed in DOM order.
      const aChildren = parent.children;
      if (aChildren) {
        for (let i = 0, len = aChildren.length; i < len; i++) {
          const child = aChildren[i];
          if (inViewport(child as HTMLElement)) {
            // The children are in DOM order, so we just have to
            // save the LAST child that was in the viewport.
            lastChildInViewport = child;
          }
        }
      }
    }

    if (lastChildInViewport) {
      // See if this last child has any children in the viewport.
      return lastViewportElement(lastChildInViewport);
    } else {
      // If NONE of the children are in the viewport, return the parent.
      // This assumes that the parent is in the viewport because it was passed in.
      return parent;
    }
  }

  // Return true if the element is in the viewport.
  function inViewport(e: HTMLElement) {
    const vh = document.documentElement.clientHeight;
    const vw = document.documentElement.clientWidth;

    // Return true if the top-left corner is in the viewport and it has width & height.
    const lt = findPos(e);
    return (
      lt[0] >= 0 &&
      lt[1] >= 0 &&
      lt[0] < vw &&
      lt[1] < vh &&
      e.offsetWidth > 0 &&
      e.offsetHeight > 0
    );
  }

  // Return an array containing the top & left coordinates of the element.
  // from http://www.quirksmode.org/js/findpos.html
  function findPos(el: HTMLElement | null): [number, number] {
    let curleft = 0;
    let curtop = 0;

    while (el) {
      try {
        curleft += el.offsetLeft;
        curtop += el.offsetTop;
        el = el.offsetParent as HTMLElement | null;
      } catch (e) {
        // If we get an exception, just return the current values.
        return [curleft, curtop];
      }
    }

    return [curleft, curtop];
  }

  /**
   * Mark the load time of the current page. Intended to be used in SPAs where it is not desirable
   * to send the beacon as soon as the page has finished loading.
   */
  function _markLoadTime(time?: number) {
    logger.logEvent(LogEvent.MarkLoadTimeCalled, [time]);

    if (time) {
      _mark(END_MARK, { startTime: time });
    } else {
      _mark(END_MARK);
    }
  }

  function createMaxMeasureTimeout() {
    clearMaxMeasureTimeout();
    gMaxMeasureTimeout = setTimeout(() => {
      gFlags = addFlag(gFlags, Flags.BeaconSentAfterTimeout);
      beacon.addFlag(Flags.BeaconSentAfterTimeout);
      _sendLux();
    }, globalConfig.maxMeasureTime - msSincePageInit());
  }

  function clearMaxMeasureTimeout() {
    if (gMaxMeasureTimeout) {
      clearTimeout(gMaxMeasureTimeout);
    }
  }

  function _getBeaconUrl(customData: CustomData.CustomDataDict) {
    const queryParams = [
      "v=" + versionAsFloat(),
      "id=" + getCustomerId(),
      "sid=" + gSyncId,
      "uid=" + gUid,
      "l=" + encodeURIComponent(_getPageLabel()),
      "HN=" + encodeURIComponent(document.location.hostname),
      "PN=" + encodeURIComponent(document.location.pathname),
    ];

    if (gFlags) {
      queryParams.push("fl=" + gFlags);
    }

    if (globalLux.snippetVersion) {
      queryParams.push("sv=" + globalLux.snippetVersion);
    }

    const customDataValues = CustomData.valuesToString(customData);

    if (customDataValues) {
      queryParams.push("CD=" + customDataValues);
      CustomData.clearUpdateCustomData();
    }

    return globalConfig.beaconUrl + "?" + queryParams.join("&");
  }

  // Beacon back the LUX data.
  function _sendLux(fromUnload: boolean = false): void {
    if (!isVisible() && !globalConfig.trackHiddenPages && !fromUnload) {
      logger.logEvent(LogEvent.SendCancelledPageHidden);
      return;
    }

    clearMaxMeasureTimeout();

    const customerid = getCustomerId();
    if (
      !customerid ||
      !gSyncId ||
      !_sample() || // OUTSIDE the sampled range
      gbLuxSent // LUX data already sent
    ) {
      return;
    }

    logger.logEvent(LogEvent.DataCollectionStart);

    const startMark = _getMark(START_MARK);
    const endMark = _getMark(END_MARK);

    if (!startMark) {
      // For hard navigations set the synthetic load time when the beacon is being sent, unless
      // one has already been set.
      if (!endMark) {
        _markLoadTime();
      }
    } else {
      // For soft navigations, only set the synthetic load time if SPA mode is not enabled, and...
      if (!globalConfig.spaMode) {
        // ...there is no existing end mark, or the end mark is from a previous SPA page.
        if (!endMark || endMark.startTime < startMark.startTime) {
          _markLoadTime();
        }
      }
    }

    // Store any tracking parameters as custom data
    const trackingParams = getTrackingParams();
    for (const key in trackingParams) {
      logger.logEvent(LogEvent.TrackingParamAdded, [key, trackingParams[key]]);
      CustomData.addCustomDataValue("_" + key, trackingParams[key]);
    }

    let sIx = "";
    let INP = getINPDetails();

    // If we haven't already sent an interaction beacon, check for interaction metrics and include
    // them in the main beacon.
    if (!gbIxSent) {
      sIx = ixValues();

      if (sIx === "") {
        // If there are no interaction metrics, we wait to send INP with the IX beacon to increase
        // the chance that we capture a valid INP.
        INP = undefined;
      }
    }

    const sET = elementTimingValues(); // Element Timing data
    const sCPU = cpuTimes();
    const clsData = CLS.getData(globalConfig);
    const sLuxjs = selfLoading();

    if (!isVisible()) {
      gFlags = addFlag(gFlags, Flags.VisibilityStateNotVisible);
      beacon.addFlag(Flags.VisibilityStateNotVisible);
    }

    if (wasPrerendered()) {
      gFlags = addFlag(gFlags, Flags.PageWasPrerendered);
      beacon.addFlag(Flags.PageWasPrerendered);
    }

    if (globalConfig.serverTiming) {
      const navEntry = getNavigationEntry();

      if (navEntry.serverTiming) {
        const stPairs = ST.getKeyValuePairs(globalConfig.serverTiming!, navEntry.serverTiming);

        for (const name in stPairs) {
          _addData(name, stPairs[name]);
        }
      }
    }

    if (LUX.conversions) {
      getMatchesFromPatternMap(LUX.conversions, location.hostname, location.pathname).forEach(
        (conversion) => {
          LUX.addData(conversion, BOOLEAN_TRUE);
        },
      );
    }

    // We want ALL beacons to have ALL the data used for query filters (geo, pagelabel, browser, & custom data).
    // So we create a base URL that has all the necessary information:
    const baseUrl = _getBeaconUrl(CustomData.getAllCustomData());

    const is = inlineTagSize("script");
    const ic = inlineTagSize("style");
    const ds = docSize();
    const ct = connectionType();
    const dt = deliveryType();

    // Note some page stat values (the `PS` query string) are non-numeric. To make extracting these
    // values easier, we append an underscore "_" to the value. Values this is used for include
    // connection type (ct) and delivery type (dt).

    const metricsQueryString =
      // only send Nav Timing and lux.js metrics on initial pageload (not for SPA page views)
      (gbNavSent ? "" : "&NT=" + getNavTiming()) +
      "&LJS=" +
      sLuxjs +
      // Page Stats
      "&PS=ns" +
      numScripts() +
      "bs" +
      blockingScripts() +
      (is > -1 ? "is" + is : "") +
      "ss" +
      numStylesheets() +
      "bc" +
      blockingStylesheets() +
      (ic > -1 ? "ic" + ic : "") +
      "ia" +
      imagesATF().length +
      "it" +
      document.getElementsByTagName("img").length + // total number of images
      "dd" +
      avgDomDepth() +
      "nd" +
      document.getElementsByTagName("*").length + // numdomelements
      "vh" +
      document.documentElement.clientHeight + // see http://www.quirksmode.org/mobile/viewports.html
      "vw" +
      document.documentElement.clientWidth +
      "dh" +
      docHeight(document) +
      "dw" +
      docWidth(document) +
      (ds ? "ds" + ds : "") + // document HTTP transfer size (bytes)
      (ct ? "ct" + ct + "_" : "") + // connection type
      (typeof dt !== "undefined" ? "dt" + dt + "_" : "") + // delivery type
      "er" +
      nErrors +
      "nt" +
      navigationType() +
      (navigator.deviceMemory ? "dm" + round(navigator.deviceMemory) : "") + // device memory (GB)
      (sIx ? "&IX=" + sIx : "") +
      (typeof gFirstInputDelay !== "undefined" ? "&FID=" + gFirstInputDelay : "") +
      (sCPU ? "&CPU=" + sCPU : "") +
      (sET ? "&ET=" + sET : "") + // element timing
      (clsData ? "&CLS=" + clsData.value.toFixed(6) : "") +
      // INP and sub-parts
      (INP ? getINPString(INP) : "");

    // We add the user timing entries last so that we can split them to reduce the URL size if necessary.
    const utValues = userTimingValues();
    let [beaconUtValues, remainingUtValues] = fitUserTimingEntries(
      utValues,
      globalConfig,
      baseUrl + metricsQueryString,
    );

    // Send the MAIN LUX beacon.
    const mainBeaconUrl =
      baseUrl +
      metricsQueryString +
      (beaconUtValues.length > 0 ? "&UT=" + beaconUtValues.join(",") : "");
    logger.logEvent(LogEvent.MainBeaconSent, [mainBeaconUrl]);
    _sendBeacon(mainBeaconUrl);

    // Set some states.
    gbLuxSent = 1;
    gbNavSent = 1;
    gbIxSent = sIx ? 1 : 0;

    // Send other beacons for JUST User Timing.
    while (remainingUtValues.length) {
      [beaconUtValues, remainingUtValues] = fitUserTimingEntries(
        remainingUtValues,
        globalConfig,
        baseUrl,
      );

      const utBeaconUrl = baseUrl + "&UT=" + beaconUtValues.join(",");
      logger.logEvent(LogEvent.UserTimingBeaconSent, [utBeaconUrl]);
      _sendBeacon(utBeaconUrl);
    }
  }

  let ixTimerId: number;

  function _sendIxAfterDelay(): void {
    clearTimeout(ixTimerId);
    ixTimerId = setTimeout(_sendIx, globalConfig.interactionBeaconDelay);
  }

  // Beacon back the IX data separately (need to sync with LUX beacon on the backend).
  function _sendIx(): void {
    const customerid = getCustomerId();
    if (
      !customerid ||
      !gSyncId ||
      !_sample() || // OUTSIDE the sampled range
      gbIxSent || // IX data already sent
      !gbLuxSent // LUX has NOT been sent yet, so wait to include it there
    ) {
      return;
    }

    const sIx = ixValues(); // Interaction Metrics
    const INP = getINPDetails();

    if (sIx) {
      const beaconUrl =
        _getBeaconUrl(CustomData.getUpdatedCustomData()) +
        "&IX=" +
        sIx +
        (typeof gFirstInputDelay !== "undefined" ? "&FID=" + gFirstInputDelay : "") +
        (typeof INP !== "undefined" ? getINPString(INP) : "");
      logger.logEvent(LogEvent.InteractionBeaconSent, [beaconUrl]);
      _sendBeacon(beaconUrl);

      gbIxSent = 1;
    }
  }

  // Beacon back custom data that is recorded _after_ the main beacon was sent
  // (i.e., custom data after window.onload).
  function _sendCustomData(): void {
    const customerid = getCustomerId();
    if (
      !customerid ||
      !gSyncId ||
      !_sample() || // OUTSIDE the sampled range
      !gbLuxSent // LUX has NOT been sent yet, so wait to include it there
    ) {
      return;
    }

    const customDataValues = CustomData.valuesToString(CustomData.getUpdatedCustomData());

    if (customDataValues) {
      const beaconUrl = _getBeaconUrl(CustomData.getUpdatedCustomData());
      logger.logEvent(LogEvent.CustomDataBeaconSent, [beaconUrl]);
      _sendBeacon(beaconUrl);
    }
  }

  function _sendBeacon(url: string) {
    new Image().src = url;

    Events.emit("beacon", url);
  }

  // INTERACTION METRICS
  // Register event handlers to detect Interaction Metrics.
  // We only need to detect the FIRST of each event, after which we remove the handler for that event..
  // Each event handler is a standalone function so we can reference that function in removeListener.

  // If the event(s) happen before LUX finishes, then the IX metric(s) is(are) sent with LUX.
  // Most of the time, however, IX happens *after* LUX, so we send a separate IX beacon but
  // only beacon back the first interaction that happens.

  function _scrollHandler() {
    // Note for scroll input we don't remove the handlers or send the IX beacon because we want to
    // capture click and key events as well, since these are typically more important than scrolls.
    if (typeof ghIx["s"] === "undefined") {
      ghIx["s"] = msSincePageInit();
    }
  }

  function _keyHandler(e: KeyboardEvent) {
    const { keyCode } = e;

    /**
     * Ignore modifier keys
     *
     * 16 = Shift
     * 17 = Control
     * 18 = Alt
     * 20 = Caps Lock
     * 224 = Meta/Command
     */
    if (keyCode === 16 || keyCode === 17 || keyCode === 18 || keyCode === 20 || keyCode === 224) {
      return;
    }

    if (typeof ghIx["k"] === "undefined") {
      ghIx["k"] = msSincePageInit();

      if (e && e.target instanceof Element) {
        const trackId = getNodeSelector(e.target);
        if (trackId) {
          ghIx["ki"] = trackId;
        }
      }

      // Only one interaction type is recorded. Scrolls are considered less important, so delete
      // any scroll times if they exist.
      delete ghIx["s"];

      _sendIxAfterDelay();
    }

    _removeIxHandlers();
  }

  function _clickHandler(e: MouseEvent) {
    if (typeof ghIx["c"] === "undefined") {
      ghIx["c"] = msSincePageInit();

      // Only one interaction type is recorded. Scrolls are considered less important, so delete
      // any scroll times if they exist.
      delete ghIx["s"];

      let target: Element | undefined;
      try {
        // Seeing "Permission denied" errors, so do a simple try-catch.
        if (e && e.target instanceof Element) {
          target = e.target;
        }
      } catch (e) {
        logger.logEvent(LogEvent.EventTargetAccessError);
      }

      if (target) {
        if (e.clientX) {
          // Save the x&y of the mouse click.
          ghIx["cx"] = e.clientX;
          ghIx["cy"] = e.clientY;
        }
        const trackId = getNodeSelector(target);
        if (trackId) {
          ghIx["ci"] = trackId;
        }
      }
      _sendIxAfterDelay();
    }

    _removeIxHandlers();
  }

  function _addUnloadHandlers() {
    const onunload = () => {
      gFlags = addFlag(gFlags, Flags.BeaconSentFromUnloadHandler);
      beacon.addFlag(Flags.BeaconSentFromUnloadHandler);
      logger.logEvent(LogEvent.UnloadHandlerTriggered);
      _sendLux(true);
      _sendIx();
      beacon.send();
    };

    // As well as visibilitychange, we also listen for pagehide. This is really only for browsers
    // with buggy visibilitychange implementations. For much older browsers that don't support
    // pagehide, we use unload and beforeunload.
    if ("onpagehide" in self) {
      addListener("pagehide", onunload, true);
    } else {
      addListener("unload", onunload, true);
      addListener("beforeunload", onunload, true);
    }

    addListener(
      "visibilitychange",
      () => {
        if (document.visibilityState === "hidden") {
          onunload();
        }
      },
      true,
    );
  }

  function _addIxHandlers() {
    addListener("scroll", _scrollHandler);
    addListener("keydown", _keyHandler);
    addListener("mousedown", _clickHandler);
  }

  function _removeIxHandlers() {
    removeListener("scroll", _scrollHandler);
    removeListener("keydown", _keyHandler);
    removeListener("mousedown", _clickHandler);
  }

  // This is a big number (epoch ms . random) that is used to matchup a LUX beacon with a separate IX beacon
  // (because they get sent at different times). Each "page view" (including SPA) should have a
  // unique gSyncId.
  function createSyncId(inSampleBucket = false): string {
    let syncId: string;

    if (inSampleBucket) {
      // "00" matches all sample rates
      syncId = Number(new Date()) + "00000";
    } else {
      syncId = Number(new Date()) + padStart(String(round(100000 * Math.random())), 5, "0");
    }

    Events.emit("new_page_id", syncId);

    return syncId;
  }

  // Unique ID (also known as Session ID)
  // We use this to track all the page views in a single user session.
  // If there is NOT a UID then set it to the new value (which is the same as the "sync ID" for this page).
  // Refresh its expiration date and return its value.
  function refreshUniqueId(newValue: string): string {
    let uid = _getCookie(SESSION_COOKIE_NAME);
    if (!uid || uid.length < 11) {
      uid = newValue;
    } else {
      // Prevent sessions lasting more than 24 hours.
      // The first 10 characters of uid is the epoch time when the session started.
      const uidStart = parseInt(uid.substring(0, 10));
      const now = Number(new Date()) / 1000; // in seconds
      if (now - uidStart > 24 * 60 * 60) {
        // older than 24 hours - reset to new value
        uid = newValue;
      }
    }

    setUniqueId(uid);

    return uid;
  }

  function setUniqueId(uid: string): string {
    _setCookie(SESSION_COOKIE_NAME, uid, gSessionTimeout);

    return uid;
  }

  // We use gUid (session ID) to do sampling. We make this available to customers so
  // they can do sampling (A/B testing) using the same session ID.
  function _getUniqueId(): string {
    return gUid;
  }

  // Return the current page label.
  function _getPageLabel() {
    if (LUX.label) {
      gFlags = addFlag(gFlags, Flags.PageLabelFromLabelProp);
      beacon.addFlag(Flags.PageLabelFromLabelProp);
      return LUX.label;
    }

    if (typeof LUX.pagegroups !== "undefined") {
      const label = getMatchesFromPatternMap(
        LUX.pagegroups,
        location.hostname,
        location.pathname,
        true,
      );

      if (label) {
        gFlags = addFlag(gFlags, Flags.PageLabelFromUrlPattern);
        beacon.addFlag(Flags.PageLabelFromUrlPattern);
        return label;
      }
    }

    if (typeof LUX.jspagelabel !== "undefined") {
      const evaluateJsPageLabel = Function('"use strict"; return ' + LUX.jspagelabel);

      try {
        const label = evaluateJsPageLabel();

        if (label) {
          gFlags = addFlag(gFlags, Flags.PageLabelFromGlobalVariable);
          beacon.addFlag(Flags.PageLabelFromGlobalVariable);
          return label;
        }
      } catch (e) {
        logger.logEvent(LogEvent.PageLabelEvaluationError, [LUX.jspagelabel, e]);
      }
    }

    // default to document.title
    gFlags = addFlag(gFlags, Flags.PageLabelFromDocumentTitle);
    beacon.addFlag(Flags.PageLabelFromDocumentTitle);
    return document.title;
  }

  function _getCookie(name: string): string | undefined {
    try {
      // Seeing "Permission denied" errors, so do a simple try-catch.
      const aTuples = document.cookie.split(";");
      for (let i = 0; i < aTuples.length; i++) {
        const aTuple = aTuples[i].split("=");
        if (name === aTuple[0].trim()) {
          // cookie name starts with " " if not first
          return unescape(aTuple[1]);
        }
      }
    } catch (e) {
      logger.logEvent(LogEvent.CookieReadError);
    }

    return undefined;
  }

  function _setCookie(name: string, value: string, seconds: number): void {
    try {
      document.cookie =
        name +
        "=" +
        escape(value) +
        (seconds ? "; max-age=" + seconds : "") +
        (globalConfig.cookieDomain ? "; domain=" + globalConfig.cookieDomain : "") +
        "; path=/; SameSite=Lax";
    } catch (e) {
      logger.logEvent(LogEvent.CookieSetError);
    }
  }

  // Set "LUX.auto=false" to disable send results automatically and
  // instead you must call LUX.send() explicitly.
  if (globalConfig.auto) {
    const sendBeaconWhenVisible = () => {
      if (globalConfig.trackHiddenPages) {
        _sendLux();
      } else {
        onVisible(_sendLux);
      }
    };

    const sendBeaconAfterMinimumMeasureTime = () => {
      const elapsedTime = msSincePageInit();
      const timeRemaining = globalConfig.minMeasureTime - elapsedTime;

      if (timeRemaining <= 0) {
        logger.logEvent(LogEvent.OnloadHandlerTriggered, [
          elapsedTime,
          globalConfig.minMeasureTime,
        ]);

        if (globalConfig.measureUntil === "onload") {
          onPageLoad(sendBeaconWhenVisible);
        }
      } else {
        // Try again after the minimum measurement time has elapsed
        setTimeout(sendBeaconAfterMinimumMeasureTime, timeRemaining);
      }
    };

    sendBeaconAfterMinimumMeasureTime();
  }

  // When newBeaconOnPageShow = true, we initiate a new page view whenever a page is restored from
  // bfcache. Since we have no "onload" event to hook into after a bfcache restore, we rely on the
  // unload and maxMeasureTime handlers to send the beacon.
  if (globalConfig.newBeaconOnPageShow) {
    addEventListener("pageshow", (event) => {
      if (event.persisted) {
        // Record the timestamp of the bfcache restore
        setPageRestoreTime(event.timeStamp);

        // In Chromium, document.visibilityState is still "hidden" when pageshow fires after a bfcache
        // restore. Wrapping this in a setTimeout ensures the browser has enough time to update the
        // visibility.
        // See https://bugs.chromium.org/p/chromium/issues/detail?id=1133363
        setTimeout(() => {
          if (gbLuxSent) {
            logger.logEvent(LogEvent.BfCacheRestore);
            // If the beacon was already sent for this page, we start a new page view and mark the
            // load time as the time it took to restore the page.
            _init(getPageRestoreTime(), false);
            _markLoadTime();
          }

          // Flag the current page as a bfcache restore
          gFlags = addFlag(gFlags, Flags.PageWasBfCacheRestored);
          beacon.addFlag(Flags.PageWasBfCacheRestored);
        }, 0);
      }
    });
  }

  // Add the unload handlers when sendBeaconOnPageHidden is enabled
  if (globalConfig.sendBeaconOnPageHidden) {
    _addUnloadHandlers();
  }

  // Regardless of userConfig.auto, we need to register the IX handlers immediately.
  _addIxHandlers();

  // Set the maximum measurement timer
  createMaxMeasureTimeout();

  /**
   * LUX functions and properties must be attached to the existing global object to ensure that
   * changes made to the global object are reflected in the "internal" LUX object, and vice versa.
   */
  const globalLux = globalConfig as LuxGlobal;

  // Functions
  globalLux.addData = _addData;
  globalLux.cmd = _runCommand;
  globalLux.getSessionId = _getUniqueId;
  globalLux.mark = _mark;
  globalLux.markLoadTime = _markLoadTime;
  globalLux.measure = _measure;
  globalLux.on = Events.subscribe;
  globalLux.snippetVersion = LUX.snippetVersion;
  globalLux.version = VERSION;

  globalLux.init = (time?: number) => {
    logger.logEvent(LogEvent.InitCalled);

    // Some customers (incorrectly) call LUX.init on the very first page load of a SPA. This would
    // cause some first-page-only data (like paint metrics) to be lost. To prevent this, we silently
    // bail from this function when we detect an unnecessary LUX.init call.
    //
    // Some notes about how this is compatible with SPA mode:
    //  - For "new" implementations where SPA mode has always been enabled, we expect
    //    LUX.startSoftNavigation() to be called instead of LUX.init(), so this code path should
    //    never be reached.
    //
    //  - For "old" implementations, we expect LUX.send() is still being called. So we can rely on
    //    there being an end mark from the previous LUX.send() call.
    //
    const endMark = _getMark(END_MARK);

    if (!endMark) {
      logger.logEvent(LogEvent.InitCallIgnored);
      return;
    }

    // In SPA mode, ensure the previous page's beacon has been sent
    if (globalConfig.spaMode) {
      beacon.send();
      _sendLux();
    }

    _init(time);
  };

  globalLux.startSoftNavigation = (time?: number): void => {
    logger.logEvent(LogEvent.TriggerSoftNavigationCalled);
    beacon.send();
    _sendLux();
    _init(time);
  };

  globalLux.send = (force?: boolean) => {
    if (globalConfig.spaMode && !force) {
      // In SPA mode, sending the beacon manually is not necessary, and is ignored unless the `force`
      // parameter has been specified.
      logger.logEvent(LogEvent.SendCancelledSpaMode);

      // If markLoadTime() has not already been called, we assume this send() call corresponds to a
      // "loaded" state and mark it as the load time. This mark is important as it is used to
      // decide whether an init() call can be ignored or not.
      const startMark = _getMark(START_MARK);
      const endMark = _getMark(END_MARK);

      if (!endMark || (startMark && endMark.startTime < startMark.startTime)) {
        _markLoadTime();
      }
    } else {
      logger.logEvent(LogEvent.SendCalled);
      beacon.send();
      _sendLux();
    }
  };

  globalLux.getDebug = () => {
    console.log(
      "SpeedCurve RUM debugging documentation: https://support.speedcurve.com/docs/rum-js-api#luxgetdebug",
    );
    return logger.getEvents();
  };

  globalLux.forceSample = () => {
    logger.logEvent(LogEvent.ForceSampleCalled);
    setUniqueId(createSyncId(true));
  };

  globalLux.doUpdate = () => {
    // Deprecated, intentionally empty.
  };

  /**
   * Run a command from the command queue
   */
  function _runCommand([fn, ...args]: Command) {
    if (typeof globalLux[fn] === "function") {
      // eslint-disable-next-line @typescript-eslint/ban-types
      (globalLux[fn] as Function).apply(globalLux, args);
    }
  }

  // Process the command queue
  if (LUX.ac && LUX.ac.length) {
    LUX.ac.forEach(_runCommand);
  }

  // process the error events that happened before lux.js got loaded
  if (typeof window.LUX_ae !== "undefined") {
    window.LUX_ae.forEach(errorHandler);
  }

  logger.logEvent(LogEvent.EvaluationEnd);

  return globalLux;
})();

window.LUX = LUX;

scriptEndTime = now();
