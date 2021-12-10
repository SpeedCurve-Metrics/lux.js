import LUX_t_start from "./start-marker";
import * as Config from "./config";
import Flags from "./flags";
import { Command, LuxGlobal, PerformanceEntryShim } from "./global";
import { InteractionInfo } from "./interaction";
import now from "./now";

let LUX: LuxGlobal = window.LUX || {};

LUX = (function () {
  const gaLog: string[] = []; // used to store debug messages

  dlog("lux.js evaluation start.");

  const version = "216";

  // Log JS errors.
  const _errorUrl = "https://lux.speedcurve.com/error/"; // everything before the "?"
  let nErrors = 0;
  const maxErrors = 5; // Some pages have 50K errors. Set a limit on how many we record.
  function errorHandler(e: ErrorEvent) {
    nErrors++;
    if (e && "undefined" !== typeof e.filename && "undefined" !== typeof e.message) {
      // it is a valid error object
      if (
        -1 !== e.filename.indexOf("/lux.js?") ||
        -1 !== e.message.indexOf("LUX") || // Always send LUX errors.
        (nErrors <= maxErrors && "function" === typeof _sample && _sample())
      ) {
        // Sample & limit other errors.
        // Send the error beacon.
        new Image().src =
          _errorUrl +
          "?v=" +
          version +
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
          "";
      }
    }
  }
  window.addEventListener("error", errorHandler);

  // Initialize performance observer
  // Note: This code was later added to the LUX snippet. In the snippet we ONLY collect
  //       Long Task entries because that is the only entry type that can not be buffered.
  //       We _copy_ any Long Tasks collected by the snippet and ignore it after that.
  const gaSnippetLongTasks = typeof window.LUX_al === "object" ? window.LUX_al : [];
  const gaPerfEntries = gaSnippetLongTasks.slice(); // array of Long Tasks (prefer the array from the snippet)

  if (typeof PerformanceObserver === "function") {
    const perfObserver = new PerformanceObserver(function (list) {
      // Keep an array of perf objects to process later.
      list.getEntries().forEach(function (entry) {
        // Only record long tasks that weren't already recorded by the PerformanceObserver in the snippet
        if (entry.entryType !== "longtask" || gaPerfEntries.indexOf(entry) === -1) {
          gaPerfEntries.push(entry);
        }
      });
    });
    try {
      if (typeof PerformanceLongTaskTiming === "function") {
        perfObserver.observe({ type: "longtask", buffered: true });
      }
      if (typeof LargestContentfulPaint === "function") {
        perfObserver.observe({ type: "largest-contentful-paint", buffered: true });
      }
      if (typeof PerformanceElementTiming === "function") {
        perfObserver.observe({ type: "element", buffered: true });
      }
      if (typeof PerformancePaintTiming === "function") {
        perfObserver.observe({ type: "paint", buffered: true });
      }
      if (typeof LayoutShift === "function") {
        perfObserver.observe({ type: "layout-shift", buffered: true });
      }
    } catch (e) {
      dlog(`Error setting up PerformanceObserver: ${e}`);
    }
  }

  // Bitmask of flags for this session & page
  let gFlags = 0;

  // array of marks where each element is a hash
  const gaMarks = typeof LUX.gaMarks !== "undefined" ? LUX.gaMarks : [];
  // array of measures where each element is a hash
  const gaMeasures = typeof LUX.gaMeasures !== "undefined" ? LUX.gaMeasures : [];
  let ghIx: InteractionInfo = {}; // hash for Interaction Metrics (scroll, click, keyboard)
  const ghData: Record<string, unknown> = {}; // hash for data that is specific to the customer (eg, userid, conversion info)
  let gbLuxSent = 0; // have we sent the LUX data? (avoid sending twice in unload)
  let gbNavSent = 0; // have we sent the Nav Timing beacon yet? (avoid sending twice for SPA)
  let gbIxSent = 0; // have we sent the IX data? (avoid sending twice for SPA)
  let gbUpdated = 0; // make sure we only self-update lux.js once
  let gbFirstPV = 1; // this is the first page view (vs. a SPA "soft nav")
  const gStartMark = "LUX_start"; // the name of the mark that corresponds to "navigationStart" for SPA
  const gEndMark = "LUX_end"; // the name of the mark that corresponds to "loadEventStart" for SPA
  const gSessionTimeout = 30 * 60; // number of seconds after which we consider a session to have "timed out" (used for calculating bouncerate)
  let gSyncId = createSyncId(); // if we send multiple beacons, use this to sync them (eg, LUX & IX) (also called "luxid")
  let gUid = refreshUniqueId(gSyncId); // cookie for this session ("Unique ID")
  let gCustomerDataTimeout: number; // setTimeout timer for sending a Customer Data beacon after onload
  const perf = window.performance;
  const gMaxQuerystring = 8190; // split the beacon querystring if it gets longer than this

  const userConfig = Config.fromObject(LUX);

  const _beaconMode = userConfig.beaconMode;
  const _beaconUrl = userConfig.beaconUrl;
  const _samplerate = userConfig.samplerate;
  dlog(
    "Sample rate = " +
      _samplerate +
      "%. " +
      (_sample()
        ? "This session IS being sampled."
        : "This session is NOT being sampled. The data will NOT show up in your LUX dashboards. Call LUX.forceSample() and try again.")
  );
  const _auto = userConfig.auto;
  const _sendBeaconOnPageHidden = userConfig.sendBeaconOnPageHidden;

  // Get a timestamp as close to navigationStart as possible.
  let _navigationStart = LUX.ns ? LUX.ns : now(); // create a _navigationStart
  let gLuxSnippetStart = 0;
  if (perf && perf.timing && perf.timing.navigationStart) {
    _navigationStart = perf.timing.navigationStart;
    // Record when the LUX snippet was evaluated relative to navigationStart.
    gLuxSnippetStart = LUX.ns ? LUX.ns - _navigationStart : 0;
  } else {
    dlog("Nav Timing is not supported.");
    gFlags = gFlags | Flags.NavTimingNotSupported;
  }

  ////////////////////// FID BEGIN
  // FIRST INPUT DELAY (FID)
  // The basic idea behind FID is to attach various input event listeners and measure the time
  // between when the event happens and when the handler executes. That is FID.
  let gFirstInputDelay: number; // this is FID
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
  function onInput(evt: Event) {
    let bCancelable = false;
    try {
      // Seeing "Permission denied" errors, so do a simple try-catch.
      bCancelable = evt.cancelable;
    } catch (e) {
      // bail - no need to return anything
      dlog("Permission error accessing input event.");
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

      if ("pointerdown" == evt.type) {
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
    const currentTimestamp = Date.now ? Date.now() : +new Date();
    const msSinceNavigationStart = currentTimestamp - _navigationStart;
    const startMark = _getMark(gStartMark);

    // For SPA page views, we use our internal mark as a reference point
    if (startMark && !absolute) {
      return msSinceNavigationStart - startMark.startTime;
    }

    // For "regular" page views, we can use performance.now() if it's available...
    if (perf && perf.now) {
      return perf.now();
    }

    // ... or we can use navigationStart as a reference point
    return msSinceNavigationStart;
  }

  // set a mark
  // NOTE: It's possible to set multiple marks with the same name.
  function _mark(name: string) {
    dlog("Enter LUX.mark(), name = " + name);
    if (perf) {
      if (perf.mark) {
        return perf.mark(name);
      } else if (perf.webkitMark) {
        return perf.webkitMark(name);
      }
    }

    gFlags = gFlags | Flags.UserTimingNotSupported;

    // shim:
    gaMarks.push({ name: name, entryType: "mark", startTime: _now(), duration: 0 });
    return;
  }

  // compute a measurement (delta)
  function _measure(name: string, startMarkName?: string, endMarkName?: string) {
    dlog("Enter LUX.measure(), name = " + name);
    if ("undefined" === typeof startMarkName && _getMark(gStartMark)) {
      // If a start mark is not specified, but the user has called _init() to set a new start,
      // then use the new start base time (similar to navigationStart) as the start mark.
      startMarkName = gStartMark;
    }

    if (perf) {
      if (perf.measure) {
        // IE 11 does not handle null and undefined correctly
        if (startMarkName) {
          if (endMarkName) {
            return perf.measure(name, startMarkName, endMarkName);
          } else {
            return perf.measure(name, startMarkName);
          }
        } else {
          return perf.measure(name);
        }
      } else if (perf.webkitMeasure) {
        return perf.webkitMeasure(name, startMarkName, endMarkName);
      }
    }

    // shim:
    let startTime = 0,
      endTime = _now();
    if (startMarkName) {
      const startMark = _getMark(startMarkName);
      if (startMark) {
        startTime = startMark.startTime;
      } else if (perf && perf.timing && perf.timing[startMarkName]) {
        // the mark name can also be a property from Navigation Timing
        startTime = perf.timing[startMarkName] - perf.timing.navigationStart;
      } else {
        // Bail - we couldn't find the startMarkName.
        return;
      }
    }

    if (endMarkName) {
      const endMark = _getMark(endMarkName);
      if (endMark) {
        endTime = endMark.startTime;
      } else if (perf && perf.timing && perf.timing[endMarkName]) {
        // the mark name can also be a property from Navigation Timing
        endTime = perf.timing[endMarkName] - perf.timing.navigationStart;
      } else {
        // Bail - we couldn't find the startMarkName.
        return;
      }
    }

    gaMeasures.push({
      name: name,
      entryType: "measure",
      startTime: startTime,
      duration: endTime - startTime,
    });

    return;
  }

  // Return THE LAST mark that matches the name.
  function _getMark(name: string): PerformanceEntryShim | undefined {
    return _getM<PerformanceEntryShim>(name, _getMarks());
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
  function _getMarks(): PerformanceEntryShim[] {
    if (perf) {
      if (perf.getEntriesByType) {
        return perf.getEntriesByType("mark");
      } else if (perf.webkitGetEntriesByType) {
        return perf.webkitGetEntriesByType("mark");
      }
    }

    return gaMarks;
  }

  // Return an array of measures.
  function _getMeasures(): PerformanceEntryShim[] {
    if (perf) {
      if (perf.getEntriesByType) {
        return perf.getEntriesByType("measure");
      } else if (perf.webkitGetEntriesByType) {
        return perf.webkitGetEntriesByType("measure");
      }
    }

    return gaMeasures;
  }

  // Return a string of User Timing Metrics formatted for beacon querystring.
  function userTimingValues(): string {
    // The User Timing spec allows for there to be multiple marks with the same name,
    // and multiple measures with the same name. But we can only send back one value
    // for a name, so we always take the MAX value. We do this by first creating a
    // hash that has the max value for each name.
    const hUT: Record<string, number> = {};
    const startMark = _getMark(gStartMark);

    // marks
    const aMarks = _getMarks();
    if (aMarks) {
      aMarks.forEach(function (m) {
        const name = m.name;

        // For user timing values taken in a SPA page load, we need to adjust them
        // so that they're zeroed against the last LUX.init() call. We zero every
        // UT value except for the internal LUX start mark.
        const tZero = name !== gStartMark && startMark ? startMark.startTime : 0;
        const markTime = Math.round(m.startTime - tZero);

        if (markTime < 0) {
          // Exclude marks that were taken before the current SPA page view
          return;
        }

        if (typeof hUT[name] === "undefined") {
          hUT[name] = markTime;
        } else {
          hUT[name] = Math.max(markTime, hUT[name]);
        }
      });
    }

    // measures
    const aMeasures = _getMeasures();
    if (aMeasures) {
      aMeasures.forEach(function (m) {
        if (startMark && m.startTime < startMark.startTime) {
          // Exclude measures that were taken before the current SPA page view
          return;
        }

        const name = m.name;
        const measureTime = Math.round(m.duration);

        if (typeof hUT[name] === "undefined") {
          hUT[name] = measureTime;
        } else {
          hUT[name] = Math.max(measureTime, hUT[name]);
        }
      });
    }

    // OK. hUT is now a hash (associative array) whose keys are the names of the
    // marks & measures, and the value is the max value. Here we create a tuple
    // for each name|value pair and then join them.
    const aUT: string[] = [];
    const aNames = Object.keys(hUT);

    aNames.forEach(function (name) {
      aUT.push(name + "|" + hUT[name]);
    });

    return aUT.join(",");
  }

  // Return a string of Element Timing Metrics formatted for beacon querystring.
  function elementTimingValues(): string {
    const aET = [];
    if (gaPerfEntries.length) {
      for (let i = 0; i < gaPerfEntries.length; i++) {
        const pe = gaPerfEntries[i] as PerformanceElementTiming;
        if ("element" === pe.entryType && pe.identifier && pe.startTime) {
          aET.push(pe.identifier + "|" + Math.round(pe.startTime));
        }
      }
    }

    return aET.join(",");
  }

  // Return a string of CPU times formatted for beacon querystring.
  function cpuTimes() {
    if ("function" !== typeof PerformanceLongTaskTiming) {
      // Do not return any CPU metrics if Long Tasks API is not supported.
      return "";
    }

    let sCPU = "";
    const hCPU: Record<string, number> = {};
    const hCPUDetails: Record<string, string> = {}; // TODO - Could remove this later after large totals go away.

    // Add up totals for each "type" of long task
    if (gaPerfEntries.length) {
      // Long Task start times are relative to NavigationStart which is "0".
      // But if it is a SPA then the relative start time is gStartMark.
      const startMark = _getMark(gStartMark);
      const tZero = startMark ? startMark.startTime : 0;

      // Do not include Long Tasks that start after the page is done.
      // For full page loads, "done" is loadEventEnd.
      let tEnd = perf.timing.loadEventEnd - perf.timing.navigationStart;

      if (startMark) {
        // For SPA page loads (determined by the presence of a start mark), "done" is gEndMark.
        const endMark = _getMark(gEndMark);

        if (endMark) {
          tEnd = endMark.startTime;
        }
      }

      for (let i = 0; i < gaPerfEntries.length; i++) {
        const p = gaPerfEntries[i] as PerformanceLongTaskTiming;
        if ("longtask" !== p.entryType) {
          continue;
        }
        let dur = Math.round(p.duration);
        if (p.startTime < tZero) {
          // In a SPA it is possible that we were in the middle of a Long Task when
          // LUX.init() was called. If so, only include the duration after tZero.
          dur -= tZero - p.startTime;
        } else if (p.startTime >= tEnd) {
          // In a SPA it is possible that a Long Task started after loadEventEnd but before our
          // callback from setTimeout(200) happened. Do not include anything that started after tEnd.
          continue;
        }

        const type = p.attribution[0].name; // TODO - is there ever more than 1 attribution???
        if (!hCPU[type]) {
          // initialize this category
          hCPU[type] = 0;
          hCPUDetails[type] = "";
        }
        hCPU[type] += dur;
        // Send back the raw startTime and duration, as well as the adjusted duration.
        hCPUDetails[type] += "," + Math.round(p.startTime) + "|" + dur;
      }
    }

    // TODO - Add more types if/when they become available.
    const jsType = "undefined" !== typeof hCPU["script"] ? "script" : "unknown"; // spec changed from "script" to "unknown" Nov 2018
    if ("undefined" === typeof hCPU[jsType]) {
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
    let fci = getFcp(); // FCI is beginning of 5 second window of no Long Tasks _after_ first contentful paint
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

    return { count: count, median: median, max: max, fci: fci };
  }

  function calculateDCLS() {
    if ("function" !== typeof LayoutShift) {
      return false;
    }

    let DCLS = 0;

    for (let i = 0; i < gaPerfEntries.length; i++) {
      const p = gaPerfEntries[i] as LayoutShift;
      if ("layout-shift" !== p.entryType || p.hadRecentInput) {
        continue;
      }
      DCLS += p.value;
    }

    // The DCL column in Redshift is REAL (FLOAT4) which stores a maximum
    // of 6 significant digits.
    return DCLS.toFixed(6);
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
    if (perf && perf.getEntriesByName) {
      // Get the lux script URL (including querystring params).
      const luxScript = getScriptElement("/js/lux.js");
      if (luxScript) {
        const aResources = perf.getEntriesByName(luxScript.src);
        if (aResources && aResources.length) {
          const r = aResources[0] as PerformanceResourceTiming;
          // DO NOT USE DURATION!!!!!
          // See https://www.stevesouders.com/blog/2014/11/25/serious-confusion-with-resource-timing/
          const dns = Math.round(r.domainLookupEnd - r.domainLookupStart);
          const tcp = Math.round(r.connectEnd - r.connectStart); // includes ssl negotiation
          const fb = Math.round(r.responseStart - r.requestStart); // first byte
          const content = Math.round(r.responseEnd - r.responseStart);
          const networkDuration = dns + tcp + fb + content;
          const parseEval = LUX_t_end - LUX_t_start;
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
            _samplerate + // sample rate
            (transferSize ? "x" + transferSize : "") +
            (gLuxSnippetStart ? "l" + gLuxSnippetStart : "") +
            "s" +
            (LUX_t_start - _navigationStart) + // when lux.js started getting evaluated relative to navigationStart
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
  function ixValues() {
    const aIx = [];
    for (const key in ghIx) {
      aIx.push(key + "|" + ghIx[key as keyof InteractionInfo]);
    }

    return aIx.join(",");
  }

  // _addData()
  function _addData(name: string, value: unknown) {
    dlog("Enter LUX.addData(), name = " + name + ", value = " + value);
    const typeN = typeof name;
    const typeV = typeof value;
    if ("string" === typeN && ("string" === typeV || "number" === typeV || "boolean" === typeV)) {
      ghData[name] = value;
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
        clearTimeout(gCustomerDataTimeout);
      }
      gCustomerDataTimeout = window.setTimeout(_sendCustomerData, 100);
    }
  }

  // _sample()
  // Return true if beacons for this page should be sampled.
  function _sample() {
    if ("undefined" === typeof gUid || "undefined" === typeof _samplerate) {
      return false; // bail
    }

    const nThis = ("" + gUid).substr(-2); // number for THIS page - from 00 to 99
    return parseInt(nThis) < _samplerate;
  }

  // Return a string of Customer Data formatted for beacon querystring.
  function customerDataValues() {
    const aData = [];
    for (let key in ghData) {
      let value = "" + ghData[key]; // convert to string (eg for ints and booleans)
      // strip delimiters (instead of escaping)
      key = key.replace(/,/g, "").replace(/\|/g, "");
      value = value.replace(/,/g, "").replace(/\|/g, "");
      aData.push(key + "|" + value);
    }

    return encodeURIComponent(aData.join(","));
  }

  // _init()
  // Use this function in Single Page Apps to reset things.
  // This function should ONLY be called within a SPA!
  // Otherwise, you might clear marks & measures that were set by a shim.
  function _init() {
    dlog("Enter LUX.init().");

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
    gaPerfEntries.splice(0); // clear out the array of performance entries (do NOT redefine gaPerfEntries!)

    // Clear flags then set the flag that init was called (ie, this is a SPA).
    gFlags = 0;
    gFlags = gFlags | Flags.InitCalled;

    // Mark the "navigationStart" for this SPA page.
    _mark(gStartMark);
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
          e.onloadcssdefined ||
          "print" === e.media ||
          "style" === e.as ||
          ("function" === typeof e.onload && "all" === e.media)
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
        dlog("Error accessing inline element innerHTML.");
        return -1;
      }
    }

    return size;
  }

  function getNavTiming() {
    let s = "";
    let ns = _navigationStart;
    const startMark = _getMark(gStartMark);
    const endMark = _getMark(gEndMark);
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
    } else if (perf && perf.timing) {
      // Return the real Nav Timing metrics because this is the "main" page view (not a SPA)
      const t = perf.timing;
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
        (startRender ? "sr" + startRender : "") +
        (fcp ? "fc" + fcp : "") +
        (lcp ? "lc" + lcp : "") +
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

  // Return First Contentful Paint or zero if not supported.
  function getFcp() {
    if (perf && perf.getEntriesByType && perf.getEntriesByType("paint")) {
      for (let arr = perf.getEntriesByType("paint"), i = 0; i < arr.length; i++) {
        const ppt = arr[i]; // PerformancePaintTiming object
        if ("first-contentful-paint" === ppt.name) {
          return Math.round(ppt.startTime);
        }
      }
    }

    return 0;
  }

  // Return Largest Contentful Paint or zero if not supported.
  function getLcp() {
    if (gaPerfEntries.length) {
      // Find the *LAST* LCP per https://web.dev/largest-contentful-paint
      for (let i = gaPerfEntries.length - 1; i >= 0; i--) {
        const pe = gaPerfEntries[i];
        if ("largest-contentful-paint" === pe.entryType) {
          return Math.round(pe.startTime);
        }
      }
    }

    return 0;
  }

  // Return best guess at Start Render time (in ms).
  // Mostly works on just Chrome and IE.
  // Return null if not supported.
  function getStartRender() {
    if (perf && perf.timing) {
      const t = perf.timing;
      const ns = t.navigationStart;
      let startRender;

      if (ns) {
        if (
          perf &&
          perf.getEntriesByType &&
          perf.getEntriesByType("paint") &&
          perf.getEntriesByType("paint").length
        ) {
          // If Paint Timing API is supported, use it.
          for (let arr = perf.getEntriesByType("paint"), i = 0; i < arr.length; i++) {
            const ppt = arr[i]; // PerformancePaintTiming object
            if ("first-paint" === ppt.name) {
              startRender = Math.round(ppt.startTime);
              break;
            }
          }
        } else if (window.chrome && "function" === typeof window.chrome.loadTimes) {
          // If chrome, get first paint time from `chrome.loadTimes`. Need extra error handling.
          const loadTimes = window.chrome.loadTimes();
          if (loadTimes) {
            startRender = Math.round(loadTimes.firstPaintTime * 1000 - ns);
          }
        } else if (t.msFirstPaint) {
          // If IE/Edge, use the prefixed `msFirstPaint` property (see http://msdn.microsoft.com/ff974719).
          startRender = Math.round(t.msFirstPaint - ns);
        }

        if (startRender) {
          return startRender;
        }
      }
    }

    dlog("Paint Timing not supported.");
    return null;
  }

  function getCustomerId() {
    if (typeof LUX.customerid !== "undefined") {
      // Return the id explicitly set in the JavaScript variable.
      return LUX.customerid;
    }

    // Extract the id of the lux.js script element.
    const luxScript = getScriptElement("/js/lux.js");
    if (luxScript) {
      LUX.customerid = getQuerystringParam(luxScript.src, "id");
      return LUX.customerid;
    }

    return "";
  }

  // Return the SCRIPT DOM element whose SRC contains the URL snippet.
  // This is used to find the LUX script element.
  function getScriptElement(urlsnippet: string) {
    const aScripts = document.getElementsByTagName("script");
    for (let i = 0, len = aScripts.length; i < len; i++) {
      const script = aScripts[i];
      if (script.src && -1 !== script.src.indexOf(urlsnippet)) {
        return script;
      }
    }

    return null;
  }

  function getQuerystringParam(url: string, name: string) {
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
  function docSize() {
    if (perf && perf.getEntriesByType) {
      const aEntries = performance.getEntriesByType("navigation") as PerformanceNavigationTiming[];
      if (aEntries && aEntries.length > 0 && aEntries[0]["encodedBodySize"]) {
        return aEntries[0]["encodedBodySize"];
      }
    }

    return 0; // ERROR - NOT FOUND
  }

  // Return the navigation type. 0 = normal, 1 = reload, etc.
  // Return empty string if not available.
  function navigationType() {
    if (perf && perf.navigation && "undefined" != typeof perf.navigation.type) {
      return perf.navigation.type;
    }

    return "";
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

  // Beacon back the LUX data.
  function _sendLux() {
    dlog("Enter LUX.send().");

    const customerid = getCustomerId();
    if (
      !customerid ||
      !gSyncId ||
      !validDomain() ||
      !_sample() || // OUTSIDE the sampled range
      gbLuxSent // LUX data already sent
    ) {
      return;
    }

    // Mark the "loadEventEnd" for this SPA page.
    _mark(gEndMark);

    const sUT = userTimingValues(); // User Timing data
    const sET = elementTimingValues(); // Element Timing data
    const sCustomerData = customerDataValues(); // customer data
    let sIx = ""; // Interaction Metrics
    if (!gbIxSent) {
      // It is possible for the IX beacon to be sent BEFORE the "main" window.onload LUX beacon.
      // Make sure we do not send the IX data twice.
      sIx = ixValues();
    }
    const sCPU = cpuTimes();
    const DCLS = calculateDCLS();
    const sLuxjs = selfLoading();
    if (document.visibilityState && "visible" !== document.visibilityState) {
      gFlags = gFlags | Flags.VisibilityStateNotVisible;
    }

    // We want ALL beacons to have ALL the data used for query filters (geo, pagelabel, browser, & customerdata).
    // So we create a base URL that has all the necessary information:
    const baseUrl =
      _beaconUrl +
      "?v=" +
      version +
      "&id=" +
      customerid +
      "&sid=" +
      gSyncId +
      "&uid=" +
      gUid +
      (sCustomerData ? "&CD=" + sCustomerData : "") +
      "&l=" +
      encodeURIComponent(_getPageLabel());

    const is = inlineTagSize("script");
    const ic = inlineTagSize("style");

    let querystring =
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
      navigationType() + // reload
      (navigator.deviceMemory ? "dm" + Math.round(navigator.deviceMemory) : "") + // device memory (GB)
      (sIx ? "&IX=" + sIx : "") +
      (gFirstInputDelay ? "&FID=" + gFirstInputDelay : "") +
      (sCPU ? "&CPU=" + sCPU : "") +
      (gFlags ? "&fl=" + gFlags : "") +
      (sET ? "&ET=" + sET : "") + // element timing
      "&HN=" +
      encodeURIComponent(document.location.hostname) +
      (DCLS !== false ? "&CLS=" + DCLS : "") +
      // fonts
      "";

    // User Timing marks & measures
    let sUT_remainder = "";
    if (sUT) {
      const curLen = baseUrl.length + querystring.length;
      if (curLen + sUT.length <= gMaxQuerystring) {
        // Add all User Timing
        querystring += "&UT=" + sUT;
      } else {
        // Only add a substring of User Timing
        const avail = gMaxQuerystring - curLen; // how much room is left in the querystring
        const iComma = sUT.lastIndexOf(",", avail); // as many UT tuples as possible
        querystring += "&UT=" + sUT.substring(0, iComma);
        sUT_remainder = sUT.substring(iComma + 1);
      }
    }

    // Send the MAIN LUX beacon.
    const mainBeaconUrl = baseUrl + querystring;
    dlog("Sending main LUX beacon: " + mainBeaconUrl);
    _sendBeacon(mainBeaconUrl);

    // Set some states.
    gbLuxSent = 1;
    gbNavSent = 1;
    gbIxSent = sIx ? 1 : 0;

    // Send other beacons for JUST User Timing.
    const avail = gMaxQuerystring - baseUrl.length;
    while (sUT_remainder) {
      let sUT_cur = "";
      if (sUT_remainder.length <= avail) {
        // We can fit ALL the remaining UT params.
        sUT_cur = sUT_remainder;
        sUT_remainder = "";
      } else {
        // We have to take a subset of the remaining UT params.
        let iComma = sUT_remainder.lastIndexOf(",", avail); // as many UT tuples as possible
        if (-1 === iComma) {
          // Trouble: we have SO LITTLE available space we can not fit the first UT tuple.
          // Try it anyway but find it by searching from the front.
          iComma = sUT_remainder.indexOf(",");
        }
        if (-1 === iComma) {
          // The is only one UT tuple left, but it is bigger than the available space.
          // Take the whole tuple even tho it is too big.
          sUT_cur = sUT_remainder;
          sUT_remainder = "";
        } else {
          sUT_cur = sUT_remainder.substring(0, iComma);
          sUT_remainder = sUT_remainder.substring(iComma + 1);
        }
      }

      const utBeaconUrl = baseUrl + "&UT=" + sUT_cur;
      dlog("Sending extra User Timing beacon: " + utBeaconUrl);
      _sendBeacon(utBeaconUrl);
    }
  }

  // Beacon back the IX data separately (need to sync with LUX beacon on the backend).
  function _sendIx() {
    const customerid = getCustomerId();
    if (
      !customerid ||
      !gSyncId ||
      !validDomain() ||
      !_sample() || // OUTSIDE the sampled range
      gbIxSent || // IX data already sent
      !gbLuxSent // LUX has NOT been sent yet, so wait to include it there
    ) {
      return;
    }

    const sIx = ixValues(); // Interaction Metrics

    if (sIx) {
      const sCustomerData = customerDataValues(); // customer data
      const querystring =
        "?v=" +
        version +
        "&id=" +
        customerid +
        "&sid=" +
        gSyncId +
        "&uid=" +
        gUid +
        (sCustomerData ? "&CD=" + sCustomerData : "") +
        "&l=" +
        encodeURIComponent(_getPageLabel()) +
        "&IX=" +
        sIx +
        (gFirstInputDelay ? "&FID=" + gFirstInputDelay : "") +
        "&HN=" +
        encodeURIComponent(document.location.hostname) +
        "";
      const beaconUrl = _beaconUrl + querystring;
      dlog("Sending Interaction Metrics beacon: " + beaconUrl);
      _sendBeacon(beaconUrl);

      gbIxSent = 1;
    }
  }

  // Beacon back customer data that is recorded _after_ the main beacon was sent
  // (i.e., customer data after window.onload).
  function _sendCustomerData() {
    const customerid = getCustomerId();
    if (
      !customerid ||
      !gSyncId ||
      !validDomain() ||
      !_sample() || // OUTSIDE the sampled range
      !gbLuxSent // LUX has NOT been sent yet, so wait to include it there
    ) {
      return;
    }

    const sCustomerData = customerDataValues(); // customer data

    if (sCustomerData) {
      const querystring =
        "?v=" +
        version +
        "&id=" +
        customerid +
        "&sid=" +
        gSyncId +
        "&uid=" +
        gUid +
        "&CD=" +
        sCustomerData +
        "&l=" +
        encodeURIComponent(_getPageLabel()) +
        "&HN=" +
        encodeURIComponent(document.location.hostname) +
        "";
      const beaconUrl = _beaconUrl + querystring;
      dlog("Sending late Customer Data beacon: " + beaconUrl);
      _sendBeacon(beaconUrl);
    }
  }

  function _sendBeacon(url: string) {
    if (LUX.beaconMode !== "simple") {
      return _sendBeaconAutoUpdate(url);
    }

    new Image().src = url;
  }

  // Send a beacon that will also trigger the self-updating mechanism
  function _sendBeaconAutoUpdate(url: string) {
    const s1 = document.createElement("script");
    s1.async = true;
    s1.src = url;
    let aElems: HTMLCollection = document.getElementsByTagName("script");
    if (aElems.length) {
      aElems[0].parentNode?.insertBefore(s1, aElems[0]);
    } else {
      aElems = document.getElementsByTagName("head");
      if (aElems.length) {
        aElems[0].appendChild(s1);
      } else {
        aElems = document.getElementsByTagName("body");
        if (aElems.length) {
          aElems[0].appendChild(s1);
        }
      }
    }
  }

  // INTERACTION METRICS
  // Register event handlers to detect Interaction Metrics.
  // We only need to detect the FIRST of each event, after which we remove the handler for that event..
  // Each event handler is a standalone function so we can reference that function in removeListener.

  // If the event(s) happen before LUX finishes, then the IX metric(s) is(are) sent with LUX.
  // Most of the time, however, IX happens *after* LUX, so we send a separate IX beacon but
  // only beacon back the first interaction that happens.

  /**
   * Get the interaction attribution name for an element
   *
   * @param {HTMLElement} el
   * @returns string
   */
  function interactionAttributionForElement(el: Element) {
    // Default to using the element's own ID if it has one
    if (el.id) {
      return el.id;
    }

    // The next preference is to find an ancestor with the "data-sctrack" attribute
    let ancestor = el;

    // We also store the first ancestor ID that we find, so we can use it as
    // a fallback later.
    let ancestorId;

    while (ancestor.parentNode && (ancestor.parentNode as Element).tagName) {
      ancestor = ancestor.parentNode as Element;

      if (ancestor.hasAttribute("data-sctrack")) {
        return ancestor.getAttribute("data-sctrack");
      }

      if (ancestor.id && !ancestorId) {
        ancestorId = ancestor.id;
      }
    }

    // The next preference is to use the text content of a button or link
    const isSubmitInput = el.tagName === "INPUT" && (el as HTMLInputElement).type === "submit";
    const isButton = el.tagName === "BUTTON";
    const isLink = el.tagName === "A";

    if (isSubmitInput && (el as HTMLInputElement).value) {
      return (el as HTMLInputElement).value;
    }

    type ButtonOrLinkElement = HTMLButtonElement | HTMLLinkElement;

    if ((isButton || isLink) && (el as ButtonOrLinkElement).innerText) {
      return (el as ButtonOrLinkElement).innerText;
    }

    // The next preference is to use the first ancestor ID
    if (ancestorId) {
      return ancestorId;
    }

    // No suitable attribute was found
    return "";
  }

  function _scrollHandler() {
    // Leave handlers IN PLACE so we can track which ID is clicked/keyed.
    // _removeIxHandlers();
    if ("undefined" === typeof ghIx["s"]) {
      ghIx["s"] = Math.round(_now());
      // _sendIx(); // wait for key or click to send the IX beacon
    }
  }

  function _keyHandler(e: KeyboardEvent) {
    _removeIxHandlers();
    if ("undefined" === typeof ghIx["k"]) {
      ghIx["k"] = Math.round(_now());

      if (e && e.target) {
        const trackId = interactionAttributionForElement(e.target as Element);
        if (trackId) {
          ghIx["ki"] = trackId;
        }
      }
      _sendIx();
    }
  }

  function _clickHandler(e: MouseEvent) {
    _removeIxHandlers();
    if ("undefined" === typeof ghIx["c"]) {
      ghIx["c"] = Math.round(_now());

      let target = null;
      try {
        // Seeing "Permission denied" errors, so do a simple try-catch.
        if (e && e.target) {
          target = e.target;
        }
      } catch (e) {
        dlog("Error accessing event target.");
        target = null;
      }

      if (target) {
        if (e.clientX) {
          // Save the x&y of the mouse click.
          ghIx["cx"] = e.clientX;
          ghIx["cy"] = e.clientY;
        }
        const trackId = interactionAttributionForElement(e.target as Element);
        if (trackId) {
          ghIx["ci"] = trackId;
        }
      }
      _sendIx();
    }
  }

  // This function is sometimes called by the /lux/ beacon response to
  // update the browser cache with the latest version of lux.js.
  function _doUpdate(newestVer: number, twiddle: string) {
    // If the newest version is newer than the browser cached version, then update.
    if (newestVer && Number(version) < newestVer && document.body && !gbUpdated) {
      dlog("Updating cached version of lux.js from " + version + " to " + newestVer + ".");
      // Since we're a SPA, it's possible that we could do an infinite number of self-updates
      // because lux.js would be refreshed, but it's not reloaded so "version" remains the same
      // until the next reload. To avoid infinite self-updates, set a flag so we only do it once.
      gbUpdated = 1;

      const luxScript = getScriptElement("/js/lux.js");
      if (luxScript) {
        if ("function" === typeof fetch) {
          // use fetch and cache:reload
          // see https://calendar.perfplanet.com/2017/clearing-cache-in-the-browser/
          fetch(luxScript.src, { cache: "reload" });
        } else {
          // old technique: use an iFrame that gets reloaded
          // see https://www.stevesouders.com/blog/2012/05/22/self-updating-scripts/
          const iframe1 = document.createElement("iframe");
          iframe1.style.display = "none";
          iframe1.id = "LUX_update_iframe";
          // twiddle allows the caller of _doUpdate to bust the browser & CDN cache if necessary
          // (this is overly cautious but gives us power if the cached code has bugs)
          iframe1.src =
            "//cdn.speedcurve.com/luxupdate.php?src=" +
            encodeURIComponent(luxScript.src) +
            (twiddle ? "&tw=" + twiddle : "");
          document.body.appendChild(iframe1);
        }
      }
    }
  }

  // Wrapper to support older browsers (<= IE8)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function addListener(type: string, callback: (event: any) => void, useCapture = false) {
    if (window.addEventListener) {
      window.addEventListener(type, callback, useCapture);
    } else if (window.attachEvent) {
      window.attachEvent("on" + type, callback as EventListener);
    }
  }

  // Wrapper to support older browsers (<= IE8)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function removeListener(type: string, callback: (event: any) => void, useCapture = false) {
    if (window.removeEventListener) {
      window.removeEventListener(type, callback, useCapture);
    } else if (window.detachEvent) {
      window.detachEvent("on" + type, callback);
    }
  }

  function _addUnloadHandlers() {
    const onunload = () => {
      gFlags = gFlags | Flags.BeaconSentFromUnloadHandler;
      _sendLux();
      _sendIx();
    };

    const onHiddenOrPageHide = (event: Event) => {
      if (event.type === "pagehide" || document.visibilityState === "hidden") {
        onunload();
      }
    };

    // As well as visibilitychange, we also listen for pagehide. This is really
    // only for browsers with buggy visibilitychange implementations. For really
    // old browsers that don't support pagehide, we use unload.
    const terminationEvent = "onpagehide" in self ? "pagehide" : "unload";

    addListener(terminationEvent, onHiddenOrPageHide, true);
    addListener("visibilitychange", onHiddenOrPageHide, true);
  }

  function _addIxHandlers() {
    addListener("scroll", _scrollHandler);
    addListener("keypress", _keyHandler);
    addListener("mousedown", _clickHandler);
  }

  function _removeIxHandlers() {
    removeListener("scroll", _scrollHandler);
    removeListener("keypress", _keyHandler);
    removeListener("mousedown", _clickHandler);
  }

  // This is a big number (epoch ms . random) that is used to matchup a LUX beacon with a separate IX beacon
  // (because they get sent at different times). Each "page view" (including SPA) should have a
  // unique gSyncId.
  function createSyncId(inSampleBucket = false): string {
    if (inSampleBucket) {
      // "00" matches all sample rates
      return `${Number(new Date())}00000`;
    }

    return `${Number(new Date())}${_padLeft(String(Math.round(100000 * Math.random())), "00000")}`;
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
    if (typeof LUX.label !== "undefined") {
      return LUX.label;
    } else if (typeof LUX.jspagelabel !== "undefined") {
      const evaluateJsPageLabel = Function(`"use strict"; return ${LUX.jspagelabel}`);

      try {
        const label = evaluateJsPageLabel();

        if (label) {
          return label;
        }
      } catch (e) {
        console.log("Error evaluating customer settings LUX page label:", e);
      }
    }

    // default to document.title
    return document.title;
  }

  // Return true if the hostname of the current page is one of the listed domains.
  function validDomain() {
    // Our signup process is such that a customer almost always deploys lux.js BEFORE we
    // enable LUX for their account. In which case, the list of domains is empty and no
    // beacons will be sent. Further, that version of lux.js will be cached at the CDN
    // and browser for a week. Instead, do the domain validation on the backend in VCL.
    return true;
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
      dlog("Error accessing document.cookie.");
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
      dlog("Error setting document.cookie.");
    }
  }

  // "padding" MUST be the length of the resulting string, eg, "0000" if you want a result of length 4.
  function _padLeft(str: string, padding: string): string {
    return (padding + str).slice(-padding.length);
  }

  // Log messages/errors to console if enabled, or put in array.
  function dlog(msg: string) {
    gaLog.push(msg);
    if (LUX.debug) {
      console.log("LUX: " + msg);
    }
  }

  // Set "LUX.auto=false" to disable send results automatically and
  // instead you must call LUX.send() explicitly.
  if (_auto) {
    if ("complete" == document.readyState) {
      // If onload has already passed, send the beacon now.
      _sendLux();
    } else {
      // Ow, send the beacon slightly after window.onload.
      addListener("load", function () {
        setTimeout(_sendLux, 200);
      });
    }
  }

  // Add the unload handlers for auto mode, or when LUX.measureUntil is "pagehidden"
  if (_sendBeaconOnPageHidden) {
    _addUnloadHandlers();
  }

  // Regardless of _auto, we need to register the IX handlers immediately.
  _addIxHandlers();

  // This is the public API.
  const _LUX = {
    // functions
    mark: _mark,
    measure: _measure,
    init: _init,
    send: _sendLux,
    addData: _addData,
    getSessionId: _getUniqueId, // so customers can do their own sampling
    getDebug: function () {
      return gaLog;
    },
    forceSample: function () {
      setUniqueId(createSyncId(true));
      console.log("Sampling has been turned on for this session.");
    },
    doUpdate: _doUpdate, // use this for self-updating
    cmd: _runCommand,

    // properties
    beaconMode: _beaconMode,
    beaconUrl: _beaconUrl, // where to send the beacon
    samplerate: _samplerate, // percentage of beacons to accept
    auto: _auto, // whether to automatically send the beacon after onload
    label: typeof LUX.label !== "undefined" ? LUX.label : undefined, // the "name" of this page or episode
    jspagelabel: typeof LUX.jspagelabel !== "undefined" ? LUX.jspagelabel : undefined,
    version: version, // use this for self-updating
    ae: [], // array for error handler (ignored)
    al: [], // array for Long Tasks (ignored)
    debug: LUX.debug ? true : false,
  };

  /**
   * Run a command from the command queue
   */
  function _runCommand([fn, ...args]: Command) {
    if (typeof _LUX[fn] === "function") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (_LUX[fn] as any).apply(_LUX, args);
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

  dlog("lux.js evaluation end.");

  return _LUX;
})();

window.LUX = LUX;

const LUX_t_end = now();
