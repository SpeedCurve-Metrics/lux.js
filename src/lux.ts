import { fitUserTimingEntries } from "./beacon";
import * as Config from "./config";
import { END_MARK, START_MARK } from "./constants";
import * as CustomData from "./custom-data";
import Flags, { addFlag } from "./flags";
import { Command, LuxGlobal } from "./global";
import { interactionAttributionForElement, InteractionInfo } from "./interaction";
import Logger, { LogEvent } from "./logger";
import * as CLS from "./metric/CLS";
import * as INP from "./metric/INP";
import now from "./now";
import {
  msSinceNavigationStart,
  performance,
  timing,
  getEntriesByType,
  PerfTimingKey,
  navigationType,
  getNavigationEntry,
} from "./performance";
import * as PO from "./performance-observer";
import scriptStartTime from "./start-marker";
import { patternMatchesUrl } from "./url-matcher";

let LUX = (window.LUX as LuxGlobal) || {};
let scriptEndTime = scriptStartTime;

LUX = (function () {
  const SCRIPT_VERSION = "307";
  const logger = new Logger();
  const globalConfig = Config.fromObject(LUX);

  logger.logEvent(LogEvent.EvaluationStart, [SCRIPT_VERSION]);

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
          SCRIPT_VERSION +
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
  window.addEventListener("error", errorHandler);

  // Most PerformanceEntry types we log an event for and add it to the global entry store.
  const processEntry = (entry: PerformanceEntry) => {
    PO.addEntry(entry);
    logger.logEvent(LogEvent.PerformanceEntryReceived, [entry]);
  };

  // Before long tasks were buffered, we added a PerformanceObserver to the lux.js snippet to capture
  // any long tasks that occurred before the full script was loaded. To deal with this, we process
  // all of the snippet long tasks, and we check for double-ups in the new PerformanceObserver.
  const snippetLongTasks = typeof window.LUX_al === "object" ? window.LUX_al : [];
  snippetLongTasks.forEach(processEntry);

  try {
    PO.observe("longtask", (entry) => {
      if (PO.ALL_ENTRIES.indexOf(entry) === -1) {
        processEntry(entry);
      }
    });

    PO.observe("largest-contentful-paint", processEntry);
    PO.observe("element", processEntry);
    PO.observe("paint", processEntry);

    PO.observe("layout-shift", (entry) => {
      processEntry(entry);
      CLS.addEntry(entry);
    });

    PO.observe("first-input", (entry) => {
      const fid = (entry as PerformanceEventTiming).processingStart - entry.startTime;

      if (!gFirstInputDelay || gFirstInputDelay < fid) {
        gFirstInputDelay = fid;
      }

      // Allow first-input events to be considered for INP
      INP.addEntry(entry);
    });

    PO.observe("event", INP.addEntry, {
      // TODO: Enable this once performance.interactionCount is widely supported. Right now we
      // have to count every event to get the total interaction count so that we can estimate
      // a high percentile value for INP.
      // durationThreshold: 40,
    });
  } catch (e) {
    logger.logEvent(LogEvent.PerformanceObserverError, [e]);
  }

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
  let gCustomerDataTimeout: number; // setTimeout timer for sending a Customer Data beacon after onload
  let gMaxMeasureTimeout: number; // setTimeout timer for sending the beacon after a maximum measurement time

  if (_sample()) {
    logger.logEvent(LogEvent.SessionIsSampled, [globalConfig.samplerate]);
  } else {
    logger.logEvent(LogEvent.SessionIsNotSampled, [globalConfig.samplerate]);
  }

  const gLuxSnippetStart = LUX.ns ? LUX.ns - timing.navigationStart : 0;

  if (!performance.timing) {
    logger.logEvent(LogEvent.NavTimingNotSupported);
    gFlags = addFlag(gFlags, Flags.NavTimingNotSupported);
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
      gFirstInputDelay = Math.round(delay); // milliseconds

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
      window.removeEventListener("pointerup", onPointerUp, ghListenerOptions);
      window.removeEventListener("pointercancel", onPointerCancel, ghListenerOptions);
    }

    window.addEventListener("pointerup", onPointerUp, ghListenerOptions);
    window.addEventListener("pointercancel", onPointerCancel, ghListenerOptions);
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
      let now = _now(true);
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
    window.addEventListener(eventType, onInput, ghListenerOptions);
  });
  ////////////////////// FID END

  /**
   * Returns the time elapsed (in ms) since navigationStart. For SPAs, returns
   * the time elapsed since the last LUX.init call.
   *
   * When `absolute = true` the time is always relative to navigationStart, even
   * in SPAs.
   */
  function _now(absolute?: boolean) {
    const sinceNavigationStart = msSinceNavigationStart();
    const startMark = _getMark(START_MARK);

    // For SPA page views, we use our internal mark as a reference point
    if (startMark && !absolute) {
      return sinceNavigationStart - startMark.startTime;
    }

    // For "regular" page views, we can use performance.now() if it's available...
    return sinceNavigationStart;
  }

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
      const startTime = args[1]?.startTime || _now();

      const entry = {
        entryType: "mark",
        duration: 0,
        name,
        detail,
        startTime,
      } as PerformanceMark;

      gaMarks.push(entry);
      gFlags = addFlag(gFlags, Flags.UserTimingNotSupported);

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
      let startTime = typeof startMarkName === "number" ? startMarkName : 0;
      let endTime = typeof endMarkName === "number" ? endMarkName : _now();
      const throwError = (missingMark: string) => {
        throw new DOMException(
          "Failed to execute 'measure' on 'Performance': The mark '" +
            missingMark +
            "' does not exist"
        );
      };

      if (typeof startMarkName === "string") {
        const startMark = _getMark(startMarkName);
        if (startMark) {
          startTime = startMark.startTime;
        } else if (timing[startMarkName as PerfTimingKey]) {
          // the mark name can also be a property from Navigation Timing
          startTime = timing[startMarkName as PerfTimingKey] - timing.navigationStart;
        } else {
          throwError(startMarkName);
        }
      }

      if (typeof endMarkName === "string") {
        const endMark = _getMark(endMarkName);
        if (endMark) {
          endTime = endMark.startTime;
        } else if (timing[endMarkName as PerfTimingKey]) {
          // the mark name can also be a property from Navigation Timing
          endTime = timing[endMarkName as PerfTimingKey] - timing.navigationStart;
        } else {
          throwError(endMarkName);
        }
      }

      let duration = Math.round(endTime) - Math.round(startTime);
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
    const tZero = startMark ? startMark.startTime : 0;

    // marks
    _getMarks().forEach((mark) => {
      const name = mark.name;

      if (name === START_MARK || name === END_MARK) {
        // Don't include the internal marks in the beacon
        return;
      }

      const startTime = Math.round(mark.startTime - tZero);

      if (startTime < 0) {
        // Exclude marks that were taken before the current SPA page view
        return;
      }

      if (typeof hUT[name] === "undefined") {
        hUT[name] = { startTime };
      } else {
        hUT[name].startTime = Math.max(startTime, hUT[name].startTime);
      }
    });

    // measures
    _getMeasures().forEach((measure) => {
      if (startMark && measure.startTime < startMark.startTime) {
        // Exclude measures that were taken before the current SPA page view
        return;
      }

      const name = measure.name;
      const startTime = Math.round(measure.startTime - tZero);
      const duration = Math.round(measure.duration);

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
    const startMark = _getMark(START_MARK);
    const tZero = startMark ? startMark.startTime : 0;

    PO.getEntries("element").forEach((entry) => {
      if (entry.identifier && entry.startTime) {
        logger.logEvent(LogEvent.PerformanceEntryProcessed, [entry]);
        aET.push(entry.identifier + "|" + Math.round(entry.startTime - tZero));
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
      // Long Task start times are relative to NavigationStart which is "0".
      // But if it is a SPA then the relative start time is gStartMark.
      const startMark = _getMark(START_MARK);
      const tZero = startMark ? startMark.startTime : 0;

      // Do not include Long Tasks that start after the page is done.
      // For full page loads, "done" is loadEventEnd.
      let tEnd = timing.loadEventEnd - timing.navigationStart;

      if (startMark) {
        // For SPA page loads (determined by the presence of a start mark), "done" is gEndMark.
        const endMark = _getMark(END_MARK);

        if (endMark) {
          tEnd = endMark.startTime;
        }
      }

      longTaskEntries.forEach((entry) => {
        let dur = Math.round(entry.duration);
        if (entry.startTime < tZero) {
          // In a SPA it is possible that we were in the middle of a Long Task when
          // LUX.init() was called. If so, only include the duration after tZero.
          dur -= tZero - entry.startTime;
        } else if (entry.startTime >= tEnd) {
          // In a SPA it is possible that a Long Task started after loadEventEnd but before our
          // callback from setTimeout(200) happened. Do not include anything that started after tEnd.
          return;
        }

        logger.logEvent(LogEvent.PerformanceEntryProcessed, [entry]);

        const type = entry.attribution[0].name; // TODO - is there ever more than 1 attribution???
        if (!hCPU[type]) {
          // initialize this category
          hCPU[type] = 0;
          hCPUDetails[type] = "";
        }
        hCPU[type] += dur;
        // Send back the raw startTime and duration, as well as the adjusted duration.
        hCPUDetails[type] += "," + Math.round(entry.startTime) + "|" + dur;
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
      hStats["count"] +
      ",d|" +
      hStats["median"] +
      ",x|" +
      hStats["max"] +
      (0 === hStats["fci"] ? "" : ",i|" + hStats["fci"]); // only add FCI if it is non-zero
    sCPU += "s|" + hCPU[jsType] + sStats + hCPUDetails[jsType];

    return sCPU;
  }

  // Return a hash of "stats" about the CPU details incl. count, max, and median.
  function cpuStats(sDetails: string) {
    // tuples of starttime|duration, eg: ,456|250,789|250,1012|250
    let max = 0;
    let fci: number = getFcp() || 0; // FCI is beginning of 5 second window of no Long Tasks _after_ first contentful paint
    // If FCP is 0 then that means FCP is not supported.
    // If FCP is not supported then we can NOT calculate a valid FCI.
    // Thus, leave FCI = 0 and exclude it from the beacon above.
    let bFoundFci = 0 === fci ? true : false;
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
            fci = start + dur; // FCI is now the end of this Long Task
          }
        }
      }
    }

    const count = aValues.length;
    const median = arrayMedian(aValues);

    return { count, median, max, fci };
  }

  function getCLS(): string | undefined {
    if (!("LayoutShift" in self)) {
      return undefined;
    }

    // The DCLS column in Redshift is REAL (FLOAT4) which stores a maximum
    // of 6 significant digits.
    return CLS.getCLS().toFixed(6);
  }

  // Return the median value from an array of integers.
  function arrayMedian(aValues: number[]): number {
    if (0 === aValues.length) {
      return 0;
    }

    const half = Math.floor(aValues.length / 2);
    aValues.sort(function (a, b) {
      return a - b;
    });

    if (aValues.length % 2) {
      // Return the middle value.
      return aValues[half];
    } else {
      // Return the average of the two middle values.
      return Math.round((aValues[half - 1] + aValues[half]) / 2.0);
    }
  }

  // Track how long it took lux.js to load via Resource Timing.
  function selfLoading() {
    let sLuxjs = "";
    if (performance.getEntriesByName) {
      // Get the lux script URL (including querystring params).
      const luxScript = getScriptElement("/js/lux.js");
      if (luxScript) {
        const aResources = performance.getEntriesByName(luxScript.src);
        if (aResources && aResources.length) {
          const r = aResources[0] as PerformanceResourceTiming;
          // DO NOT USE DURATION!!!!!
          // See https://www.stevesouders.com/blog/2014/11/25/serious-confusion-with-resource-timing/
          const dns = Math.round(r.domainLookupEnd - r.domainLookupStart);
          const tcp = Math.round(r.connectEnd - r.connectStart); // includes ssl negotiation
          const fb = Math.round(r.responseStart - r.requestStart); // first byte
          const content = Math.round(r.responseEnd - r.responseStart);
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
    }

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
      aIx.push(key + "|" + ghIx[key as keyof InteractionInfo]);
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
      // _after_ window.onload. So we have to send a Customer Data beacon that
      // includes the new customer data.
      // Do setTimeout so that if there are multiple back-to-back addData calls
      // we get them all in one beacon.
      if (gCustomerDataTimeout) {
        // Cancel the timer for any previous beacons so that if they have not
        // yet been sent we can combine all the data in a new beacon.
        window.clearTimeout(gCustomerDataTimeout);
      }

      gCustomerDataTimeout = window.setTimeout(_sendCustomerData, 100);
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

  // _init()
  // Use this function in Single Page Apps to reset things.
  // This function should ONLY be called within a SPA!
  // Otherwise, you might clear marks & measures that were set by a shim.
  function _init(): void {
    // Some customers (incorrectly) call LUX.init on the very first page load of a SPA. This would
    // cause some first-page-only data (like paint metrics) to be lost. To prevent this, we silently
    // bail from this function when we detect an unnecessary LUX.init call.
    const endMark = _getMark(END_MARK);

    if (!endMark) {
      return;
    }

    logger.logEvent(LogEvent.InitCalled);

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
    PO.clearEntries();
    CLS.reset();
    INP.reset();
    nErrors = 0;
    gFirstInputDelay = undefined;

    // Clear flags then set the flag that init was called (ie, this is a SPA).
    gFlags = 0;
    gFlags = addFlag(gFlags, Flags.InitCalled);

    // Mark the "navigationStart" for this SPA page.
    _mark(START_MARK);

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
    if (startMark && endMark) {
      // This is a SPA page view, so send the SPA marks & measures instead of Nav Timing.
      const start = Math.round(startMark.startTime); // the start mark is "zero"
      ns += start; // "navigationStart" for a SPA is the real navigationStart plus the start mark
      const end = Math.round(endMark.startTime) - start; // delta from start mark
      s =
        ns +
        "fs" +
        0 + // fetchStart is the same as navigationStart for a SPA
        "ls" +
        end +
        "le" +
        end +
        "";
    } else if (performance.timing) {
      // Return the real Nav Timing metrics because this is the "main" page view (not a SPA)
      const t = timing;
      const startRender = getStartRender(); // first paint
      const fcp = getFcp(); // first contentful paint
      const lcp = getLcp(); // largest contentful paint
      s =
        ns +
        (t.redirectStart ? "rs" + (t.redirectStart - ns) : "") +
        (t.redirectEnd ? "re" + (t.redirectEnd - ns) : "") +
        (t.fetchStart ? "fs" + (t.fetchStart - ns) : "") +
        (t.domainLookupStart ? "ds" + (t.domainLookupStart - ns) : "") +
        (t.domainLookupEnd ? "de" + (t.domainLookupEnd - ns) : "") +
        (t.connectStart ? "cs" + (t.connectStart - ns) : "") +
        (t.secureConnectionStart ? "sc" + (t.secureConnectionStart - ns) : "") +
        (t.connectEnd ? "ce" + (t.connectEnd - ns) : "") +
        (t.requestStart ? "qs" + (t.requestStart - ns) : "") + // reQuest start
        (t.responseStart ? "bs" + (t.responseStart - ns) : "") + // body start
        (t.responseEnd ? "be" + (t.responseEnd - ns) : "") +
        (t.domLoading ? "ol" + (t.domLoading - ns) : "") +
        (t.domInteractive ? "oi" + (t.domInteractive - ns) : "") +
        (t.domContentLoadedEventStart ? "os" + (t.domContentLoadedEventStart - ns) : "") +
        (t.domContentLoadedEventEnd ? "oe" + (t.domContentLoadedEventEnd - ns) : "") +
        (t.domComplete ? "oc" + (t.domComplete - ns) : "") +
        (t.loadEventStart ? "ls" + (t.loadEventStart - ns) : "") +
        (t.loadEventEnd ? "le" + (t.loadEventEnd - ns) : "") +
        (typeof startRender !== "undefined" ? "sr" + startRender : "") +
        (typeof fcp !== "undefined" ? "fc" + fcp : "") +
        (typeof lcp !== "undefined" ? "lc" + lcp : "") +
        "";
    } else if (endMark) {
      // This is a "main" page view that does NOT support Navigation Timing - strange.
      const end = Math.round(endMark.startTime);
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
        return Math.round(entry.startTime);
      }
    }

    return undefined;
  }

  // Return Largest Contentful Paint or undefined if not supported.
  function getLcp(): number | undefined {
    const lcpEntries = PO.getEntries("largest-contentful-paint");

    if (lcpEntries.length) {
      const lastEntry = lcpEntries[lcpEntries.length - 1];
      logger.logEvent(LogEvent.PerformanceEntryProcessed, [lastEntry]);
      return Math.max(0, Math.round(lastEntry.startTime - getNavigationEntry().activationStart));
    }

    return undefined;
  }

  // Return best guess at Start Render time (in ms).
  // Mostly works on just Chrome and IE.
  // Return undefined if not supported.
  function getStartRender(): number | undefined {
    if (performance.timing) {
      const paintEntries = getEntriesByType("paint");

      if (paintEntries.length) {
        // If Paint Timing API is supported, use it.
        for (let i = 0; i < paintEntries.length; i++) {
          const entry = paintEntries[i];

          if (entry.name === "first-paint") {
            return Math.round(entry.startTime);
          }
        }
      } else if (timing.msFirstPaint && __ENABLE_POLYFILLS) {
        // If IE/Edge, use the prefixed `msFirstPaint` property (see http://msdn.microsoft.com/ff974719).
        return Math.round(timing.msFirstPaint - timing.navigationStart);
      }
    }

    logger.logEvent(LogEvent.PaintTimingNotSupported);

    return undefined;
  }

  function getINP(): number | undefined {
    if (!("PerformanceEventTiming" in self)) {
      return undefined;
    }

    return INP.getHighPercentileINP();
  }

  function getCustomerId() {
    if (typeof LUX.customerid === "undefined") {
      // Extract the id of the lux.js script element.
      const luxScript = getScriptElement("/js/lux.js");
      if (luxScript) {
        LUX.customerid = getQuerystringParam(luxScript.src, "id");
      }
    }

    return LUX.customerid || "";
  }

  // Return the SCRIPT DOM element whose SRC contains the URL snippet.
  // This is used to find the LUX script element.
  function getScriptElement(urlsnippet: string): HTMLScriptElement | undefined {
    const aScripts = document.getElementsByTagName("script");
    for (let i = 0, len = aScripts.length; i < len; i++) {
      const script = aScripts[i];
      if (script.src && -1 !== script.src.indexOf(urlsnippet)) {
        return script;
      }
    }

    return undefined;
  }

  function getQuerystringParam(url: string, name: string): string | undefined {
    const qs = url.split("?")[1];
    const aTuples = qs.split("&");
    for (let i = 0, len = aTuples.length; i < len; i++) {
      const tuple = aTuples[i];
      const aTuple = tuple.split("=");
      const key = aTuple[0];
      if (name === key) {
        return aTuple[1];
      }
    }

    return undefined;
  }

  function avgDomDepth() {
    const aElems = document.getElementsByTagName("*");
    let i = aElems.length;
    let totalParents = 0;
    while (i--) {
      totalParents += numParents(aElems[i]);
    }
    const average = Math.round(totalParents / aElems.length);
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
    const height = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      docelem ? docelem.clientHeight : 0,
      docelem ? docelem.scrollHeight : 0,
      docelem ? docelem.offsetHeight : 0
    );
    return height;
  }

  function docWidth(doc: Document) {
    const body = doc.body,
      docelem = doc.documentElement;
    const width = Math.max(
      body ? body.scrollWidth : 0,
      body ? body.offsetWidth : 0,
      docelem ? docelem.clientWidth : 0,
      docelem ? docelem.scrollWidth : 0,
      docelem ? docelem.offsetWidth : 0
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
  function findPos(e: HTMLElement | null): [number, number] {
    let curleft = 0;
    let curtop = 0;

    while (e) {
      curleft += e.offsetLeft;
      curtop += e.offsetTop;
      e = e.offsetParent as HTMLElement | null;
    }

    return [curleft, curtop];
  }

  // Mark the load time of the current page. Intended to be used in SPAs where it is not desirable to
  // send the beacon as soon as the page has finished loading.
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
    gMaxMeasureTimeout = window.setTimeout(() => {
      gFlags = addFlag(gFlags, Flags.BeaconSentAfterTimeout);
      _sendLux();
    }, globalConfig.maxMeasureTime - _now());
  }

  function clearMaxMeasureTimeout() {
    if (gMaxMeasureTimeout) {
      window.clearTimeout(gMaxMeasureTimeout);
    }
  }

  function _getBeaconUrl(customData: CustomData.CustomDataDict) {
    const queryParams = [
      "v=" + SCRIPT_VERSION,
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

    const customerData = CustomData.valuesToString(customData);

    if (customerData) {
      queryParams.push("CD=" + customerData);
      CustomData.clearUpdateCustomData();
    }

    return globalConfig.beaconUrl + "?" + queryParams.join("&");
  }

  // Beacon back the LUX data.
  function _sendLux(): void {
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

    if (!startMark || (endMark && endMark.startTime < startMark.startTime)) {
      // Record the synthetic loadEventStart time for this page, unless it was already recorded
      // with LUX.markLoadTime()
      _markLoadTime();
    }

    let sIx = "";
    let INP = getINP();

    // It's possible that the interaction beacon has been sent before the main beacon. We don't want
    // to send the interaction metrics twice, so we only include them here if the interaction beacon
    // has not been sent.
    if (!gbIxSent) {
      sIx = ixValues();

      if (sIx === "") {
        // If there are no interaction metrics, we
        INP = undefined;
      }
    }

    const sET = elementTimingValues(); // Element Timing data
    const sCPU = cpuTimes();
    const CLS = getCLS();
    const sLuxjs = selfLoading();
    if (document.visibilityState && "visible" !== document.visibilityState) {
      gFlags = addFlag(gFlags, Flags.VisibilityStateNotVisible);
    }

    // We want ALL beacons to have ALL the data used for query filters (geo, pagelabel, browser, & customerdata).
    // So we create a base URL that has all the necessary information:
    const baseUrl = _getBeaconUrl(CustomData.getAllCustomData());

    const is = inlineTagSize("script");
    const ic = inlineTagSize("style");

    const metricsQueryString =
      // only send Nav Timing and lux.js metrics on initial pageload (not for SPA page views)
      (gbNavSent ? "" : "&NT=" + getNavTiming()) +
      (gbFirstPV ? "&LJS=" + sLuxjs : "") +
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
      (docSize() ? "ds" + docSize() : "") + // document HTTP transfer size (bytes)
      (connectionType() ? "ct" + connectionType() + "_" : "") + // delimit with "_" since values can be non-numeric so need a way to extract with regex in VCL
      "er" +
      nErrors +
      "nt" +
      navigationType() +
      (navigator.deviceMemory ? "dm" + Math.round(navigator.deviceMemory) : "") + // device memory (GB)
      (sIx ? "&IX=" + sIx : "") +
      (typeof gFirstInputDelay !== "undefined" ? "&FID=" + gFirstInputDelay : "") +
      (sCPU ? "&CPU=" + sCPU : "") +
      (sET ? "&ET=" + sET : "") + // element timing
      (typeof CLS !== "undefined" ? "&CLS=" + CLS : "") +
      (typeof INP !== "undefined" ? "&INP=" + INP : "");

    // We add the user timing entries last so that we can split them to reduce the URL size if necessary.
    const utValues = userTimingValues();
    let [beaconUtValues, remainingUtValues] = fitUserTimingEntries(
      utValues,
      globalConfig,
      baseUrl + metricsQueryString
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
        baseUrl
      );

      const utBeaconUrl = baseUrl + "&UT=" + beaconUtValues.join(",");
      logger.logEvent(LogEvent.UserTimingBeaconSent, [utBeaconUrl]);
      _sendBeacon(utBeaconUrl);
    }
  }

  let ixTimerId: number;

  function _sendIxAfterDelay(): void {
    window.clearTimeout(ixTimerId);
    ixTimerId = window.setTimeout(_sendIx, 100);
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
    const INP = getINP();

    if (sIx) {
      const beaconUrl =
        _getBeaconUrl(CustomData.getUpdatedCustomData()) +
        "&IX=" +
        sIx +
        (typeof gFirstInputDelay !== "undefined" ? "&FID=" + gFirstInputDelay : "") +
        (typeof INP !== "undefined" ? "&INP=" + INP : "");
      logger.logEvent(LogEvent.InteractionBeaconSent, [beaconUrl]);
      _sendBeacon(beaconUrl);

      gbIxSent = 1;
    }
  }

  // Beacon back customer data that is recorded _after_ the main beacon was sent
  // (i.e., customer data after window.onload).
  function _sendCustomerData(): void {
    const customerid = getCustomerId();
    if (
      !customerid ||
      !gSyncId ||
      !_sample() || // OUTSIDE the sampled range
      !gbLuxSent // LUX has NOT been sent yet, so wait to include it there
    ) {
      return;
    }

    const sCustomerData = CustomData.valuesToString(CustomData.getUpdatedCustomData());

    if (sCustomerData) {
      const beaconUrl = _getBeaconUrl(CustomData.getUpdatedCustomData());
      logger.logEvent(LogEvent.CustomDataBeaconSent, [beaconUrl]);
      _sendBeacon(beaconUrl);
    }
  }

  function _sendBeacon(url: string) {
    new Image().src = url;
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
      ghIx["s"] = Math.round(_now());
    }
  }

  function _keyHandler(e: KeyboardEvent) {
    _removeIxHandlers();
    if (typeof ghIx["k"] === "undefined") {
      ghIx["k"] = Math.round(_now());

      if (e && e.target instanceof Element) {
        const trackId = interactionAttributionForElement(e.target);
        if (trackId) {
          ghIx["ki"] = trackId;
        }
      }
      _sendIxAfterDelay();
    }
  }

  function _clickHandler(e: MouseEvent) {
    _removeIxHandlers();
    if (typeof ghIx["c"] === "undefined") {
      ghIx["c"] = Math.round(_now());

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
        const trackId = interactionAttributionForElement(target);
        if (trackId) {
          ghIx["ci"] = trackId;
        }
      }
      _sendIxAfterDelay();
    }
  }

  // Wrapper to support older browsers (<= IE8)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addListener(type: string, callback: (event: any) => void, useCapture = false) {
    if (window.addEventListener) {
      window.addEventListener(type, callback, useCapture);
    } else if (window.attachEvent && __ENABLE_POLYFILLS) {
      window.attachEvent("on" + type, callback as EventListener);
    }
  }

  // Wrapper to support older browsers (<= IE8)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function removeListener(type: string, callback: (event: any) => void, useCapture = false) {
    if (window.removeEventListener) {
      window.removeEventListener(type, callback, useCapture);
    } else if (window.detachEvent && __ENABLE_POLYFILLS) {
      window.detachEvent("on" + type, callback);
    }
  }

  function _addUnloadHandlers() {
    const onunload = () => {
      gFlags = addFlag(gFlags, Flags.BeaconSentFromUnloadHandler);
      logger.logEvent(LogEvent.UnloadHandlerTriggered);
      _sendLux();
      _sendIx();
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
      true
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
    if (inSampleBucket) {
      // "00" matches all sample rates
      return Number(new Date()) + "00000";
    }

    return Number(new Date()) + _padLeft(String(Math.round(100000 * Math.random())), "00000");
  }

  // Unique ID (also known as Session ID)
  // We use this to track all the page views in a single user session.
  // If there is NOT a UID then set it to the new value (which is the same as the "sync ID" for this page).
  // Refresh its expiration date and return its value.
  function refreshUniqueId(newValue: string): string {
    let uid = _getCookie("lux_uid");
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
    _setCookie("lux_uid", uid, gSessionTimeout);

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

      return LUX.label;
    } else if (typeof LUX.pagegroups !== "undefined") {
      const pagegroups = LUX.pagegroups;
      let label = "";
      for (const pagegroup in pagegroups) {
        const rules = pagegroups[pagegroup];
        if (Array.isArray(rules)) {
          rules.every((rule: string) => {
            if (patternMatchesUrl(rule, document.location.hostname, document.location.pathname)) {
              label = pagegroup;
              return false; // stop when first match is found
            }
            return true;
          });
        }
        // exits loop when first match is found
        if (label) {
          gFlags = addFlag(gFlags, Flags.PageLabelFromPagegroup);
          return label;
        }
      }
    }
    if (typeof LUX.jspagelabel !== "undefined") {
      const evaluateJsPageLabel = Function('"use strict"; return ' + LUX.jspagelabel);

      try {
        const label = evaluateJsPageLabel();

        if (label) {
          gFlags = addFlag(gFlags, Flags.PageLabelFromGlobalVariable);

          return label;
        }
      } catch (e) {
        logger.logEvent(LogEvent.PageLabelEvaluationError, [LUX.jspagelabel, e]);
      }
    }

    // default to document.title
    gFlags = addFlag(gFlags, Flags.PageLabelFromDocumentTitle);

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
        "; path=/; SameSite=Lax";
    } catch (e) {
      logger.logEvent(LogEvent.CookieSetError);
    }
  }

  // "padding" MUST be the length of the resulting string, eg, "0000" if you want a result of length 4.
  function _padLeft(str: string, padding: string): string {
    return (padding + str).slice(-padding.length);
  }

  // Set "LUX.auto=false" to disable send results automatically and
  // instead you must call LUX.send() explicitly.
  if (globalConfig.auto) {
    const sendBeaconAfterMinimumMeasureTime = () => {
      const elapsedTime = _now();
      const timeRemaining = globalConfig.minMeasureTime - elapsedTime;

      if (timeRemaining <= 0) {
        logger.logEvent(LogEvent.OnloadHandlerTriggered, [
          elapsedTime,
          globalConfig.minMeasureTime,
        ]);

        if (document.readyState === "complete") {
          // If onload has already passed, send the beacon now.
          _sendLux();
        } else {
          // Ow, send the beacon slightly after window.onload.
          addListener("load", () => {
            setTimeout(_sendLux, 200);
          });
        }
      } else {
        // Try again after the minimum measurement time has elapsed
        setTimeout(sendBeaconAfterMinimumMeasureTime, timeRemaining);
      }
    };

    sendBeaconAfterMinimumMeasureTime();
  }

  // Add the unload handlers for auto mode, or when LUX.measureUntil is "pagehidden"
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
  globalLux.mark = _mark;
  globalLux.measure = _measure;
  globalLux.init = _init;
  globalLux.markLoadTime = _markLoadTime;
  globalLux.send = () => {
    logger.logEvent(LogEvent.SendCalled);
    _sendLux();
  };
  globalLux.addData = _addData;
  globalLux.getSessionId = _getUniqueId; // so customers can do their own sampling
  globalLux.getDebug = () => logger.getEvents();
  globalLux.forceSample = () => {
    logger.logEvent(LogEvent.ForceSampleCalled);
    setUniqueId(createSyncId(true));
  };
  globalLux.doUpdate = () => {
    // Deprecated, intentionally empty.
  };
  globalLux.cmd = _runCommand;

  // Public properties
  globalLux.version = SCRIPT_VERSION;

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
