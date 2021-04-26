// Instead of polyfill'ing window.performance, we create an API under the LUX namespace.
// We don't want to polyfill unless we're going to implement the entire performance API,
// or it confuses other people's code that checks for feature support.
var LUX_t_start = Date.now();

var LUX = window.LUX || {};

LUX = (function () {
  var gaLog = []; // used to store debug messages

  dlog("lux.js evaluation start.");

  var version = "212";

  // Log JS errors.
  var _errorUrl = "https://lux.speedcurve.com/error/"; // everything before the "?"
  var nErrors = 0;
  var maxErrors = 5; // Some pages have 50K errors. Set a limit on how many we record.
  function errorHandler(e) {
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
  var gaSnippetLongTasks = typeof window.LUX_al === "object" ? window.LUX_al : [];
  var gaPerfEntries = gaSnippetLongTasks.slice(); // array of Long Tasks (prefer the array from the snippet)
  if ("function" === typeof PerformanceObserver) {
    var perfObserver = new PerformanceObserver(function (list) {
      // Keep an array of perf objects to process later.
      list.getEntries().forEach(function (entry) {
        // Only record long tasks that weren't already recorded by the PerformanceObserver in the snippet
        if (
          gaSnippetLongTasks.length === 0 ||
          (entry.entryType === "longtask" && gaPerfEntries.indexOf(entry) === -1)
        ) {
          gaPerfEntries.push(entry);
        }
      });
    });
    try {
      if ("function" === typeof PerformanceLongTaskTiming) {
        perfObserver.observe({ type: "longtask", buffered: true });
      }
      if ("function" === typeof LargestContentfulPaint) {
        perfObserver.observe({ type: "largest-contentful-paint", buffered: true });
      }
      if ("function" === typeof PerformanceElementTiming) {
        perfObserver.observe({ type: "element", buffered: true });
      }
      if ("function" === typeof PerformancePaintTiming) {
        perfObserver.observe({ type: "paint", buffered: true });
      }
      if ("function" === typeof LayoutShift) {
        perfObserver.observe({ type: "layout-shift", buffered: true });
      }
    } catch (e) {
      dlog("Long Tasks error.");
    }
  } else {
    dlog("Long Tasks not supported.");
  }

  var gFlags = 0; // bitmask of flags for this session & page
  var gFlag_InitCalled = 1; // the init function was called (this is probably a SPA page view) - next will be 2,4,8,etc. up to 31 bits
  var gFlag_NoNavTiming = 2;
  var gFlag_NoUserTiming = 4;
  var gFlag_NotVisible = 8;
  // array of marks where each element is a hash
  var gaMarks = typeof LUX.gaMarks !== "undefined" ? LUX.gaMarks : [];
  // array of measures where each element is a hash
  var gaMeasures = typeof LUX.gaMeasures !== "undefined" ? LUX.gaMeasures : [];
  var ghIx = {}; // hash for Interaction Metrics (scroll, click, keyboard)
  var ghData = {}; // hash for data that is specific to the customer (eg, userid, conversion info)
  var gbLuxSent = 0; // have we sent the LUX data? (avoid sending twice in unload)
  var gbNavSent = 0; // have we sent the Nav Timing beacon yet? (avoid sending twice for SPA)
  var gbIxSent = 0; // have we sent the IX data? (avoid sending twice for SPA)
  var gbUpdated = 0; // make sure we only self-update lux.js once
  var gbFirstPV = 1; // this is the first page view (vs. a SPA "soft nav")
  var gStartMark = "LUX_start"; // the name of the mark that corresponds to "navigationStart" for SPA
  var gEndMark = "LUX_end"; // the name of the mark that corresponds to "loadEventStart" for SPA
  var gSessionTimeout = 30 * 60; // number of seconds after which we consider a session to have "timed out" (used for calculating bouncerate)
  var gSyncId = createSyncId(); // if we send multiple beacons, use this to sync them (eg, LUX & IX) (also called "luxid")
  var gUid = refreshUniqueId(gSyncId); // cookie for this session ("Unique ID")
  var gCustomerDataTimeout; // setTimeout timer for sending a Customer Data beacon after onload
  var perf = window.performance;
  var gMaxQuerystring = 2000; // split the beacon querystring if it gets longer than this
  // Customers can override this by setting LUX.beaconUrl.
  var _beaconUrl =
    typeof LUX.beaconUrl !== "undefined" ? LUX.beaconUrl : "https://lux.speedcurve.com/lux/"; // everything before the "?"
  var _samplerate = typeof LUX.samplerate !== "undefined" ? LUX.samplerate : 100;
  dlog(
    "Sample rate = " +
      _samplerate +
      "%. " +
      (_sample()
        ? "This session IS being sampled."
        : "This session is NOT being sampled. The data will NOT show up in your LUX dashboards. Call LUX.forceSample() and try again.")
  );
  var _auto = typeof LUX.auto !== "undefined" ? LUX.auto : true;

  // Get a timestamp as close to navigationStart as possible.
  var _navigationStart = LUX.ns ? LUX.ns : Date.now ? Date.now() : +new Date(); // create a _navigationStart
  var gLuxSnippetStart = 0;
  if (perf && perf.timing && perf.timing.navigationStart) {
    _navigationStart = perf.timing.navigationStart;
    // Record when the LUX snippet was evaluated relative to navigationStart.
    gLuxSnippetStart = LUX.ns ? LUX.ns - _navigationStart : 0;
  } else {
    dlog("Nav Timing is not supported.");
    gFlags = gFlags | gFlag_NoNavTiming;
  }

  ////////////////////// FID BEGIN
  // FIRST INPUT DELAY (FID)
  // The basic idea behind FID is to attach various input event listeners and measure the time
  // between when the event happens and when the handler executes. That is FID.
  var gFirstInputDelay; // this is FID
  var gaEventTypes = ["click", "mousedown", "keydown", "touchstart", "pointerdown"]; // NOTE: does NOT include scroll!
  var ghListenerOptions = { passive: true, capture: true };

  // Record the FIRST input delay.
  function recordDelay(delay) {
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
  function onPointerDown(delay, evt) {
    function onPointerUp() {
      recordDelay(delay, evt);
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
  function onInput(evt) {
    var bCancelable = false;
    try {
      // Seeing "Permission denied" errors, so do a simple try-catch.
      bCancelable = evt.cancelable;
    } catch (e) {
      // bail - no need to return anything
      dlog("Permission error accessing input event.");
      return;
    }

    if (bCancelable) {
      var now = _now();
      var eventTimeStamp = evt.timeStamp;

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

      var delay = now - eventTimeStamp;

      if ("pointerdown" == evt.type) {
        // special case
        onPointerDown(delay, evt);
      } else {
        recordDelay(delay, evt);
      }
    }
  }

  // Attach event listener to input events.
  gaEventTypes.forEach(function (eventType) {
    window.addEventListener(eventType, onInput, ghListenerOptions);
  });
  ////////////////////// FID END

  // now() returns the number of ms since navigationStart.
  function _now() {
    if (perf && perf.now) {
      return perf.now();
    }

    var n = Date.now ? Date.now() : +new Date();
    return n - _navigationStart;
  }

  // set a mark
  // NOTE: It's possible to set multiple marks with the same name.
  function _mark(name) {
    dlog("Enter LUX.mark(), name = " + name);
    if (perf) {
      if (perf.mark) {
        return perf.mark(name);
      } else if (perf.webkitMark) {
        return perf.webkitMark(name);
      }
    }

    gFlags = gFlags | gFlag_NoUserTiming;

    // shim:
    gaMarks.push({ name: name, entryType: "mark", startTime: _now(), duration: 0 });
    return;
  }

  // compute a measurement (delta)
  function _measure(name, startMarkName, endMarkName) {
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
    var startTime = 0,
      endTime = _now();
    if (startMarkName) {
      var startMark = _getMark(startMarkName);
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
      var endMark = _getMark(endMarkName);
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
  function _getMark(name) {
    return _getM(name, _getMarks());
  }

  function _getM(name, aItems) {
    if (aItems) {
      for (var i = aItems.length - 1; i >= 0; i--) {
        var m = aItems[i];
        if (name === m.name) {
          return m;
        }
      }
    }

    return undefined;
  }

  // Return an array of marks.
  function _getMarks() {
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
  function _getMeasures() {
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
  function userTimingValues() {
    // The User Timing spec allows for there to be multiple marks with the same name,
    // and multiple measures with the same name. But we can only send back one value
    // for a name, so we always take the MAX value. We do this by first creating a
    // hash that has the max value for each name.
    const hUT = {};
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
    const aUT = [];
    const aNames = Object.keys(hUT);

    aNames.forEach(function (name) {
      aUT.push(name + "|" + hUT[name]);
    });

    return aUT.join(",");
  }

  // Return a string of Element Timing Metrics formatted for beacon querystring.
  function elementTimingValues() {
    var aET = [];
    if (gaPerfEntries.length) {
      for (var i = 0; i < gaPerfEntries.length; i++) {
        var pe = gaPerfEntries[i];
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

    var sCPU = "";
    var hCPU = {};
    var hCPUDetails = {}; // TODO - Could remove this later after large totals go away.

    // Add up totals for each "type" of long task
    if (gaPerfEntries.length) {
      // Long Task start times are relative to NavigationStart which is "0".
      // But if it is a SPA then the relative start time is gStartMark.
      var startMark = _getMark(gStartMark);
      var tZero = startMark ? startMark.startTime : 0;
      // Do not include Long Tasks that start _after_ the page is done.
      // For "main" pages, done is loadEventEnd. For SPA pages, it is gEndMark (but since we set
      //   gEndMark for _all_ pages we test if it is a SPA by the presence of gStartMark.)
      var tEnd = startMark
        ? _getMark(gEndMark).startTime
        : perf.timing.loadEventEnd - perf.timing.navigationStart;

      for (var i = 0; i < gaPerfEntries.length; i++) {
        var p = gaPerfEntries[i];
        if ("longtask" !== p.entryType) {
          continue;
        }
        var dur = Math.round(p.duration);
        if (p.startTime < tZero) {
          // In a SPA it is possible that we were in the middle of a Long Task when
          // LUX.init() was called. If so, only include the duration after tZero.
          dur -= tZero - p.startTime;
        } else if (p.startTime >= tEnd) {
          // In a SPA it is possible that a Long Task started after loadEventEnd but before our
          // callback from setTimeout(200) happened. Do not include anything that started after tEnd.
          continue;
        }

        var type = p.attribution[0].name; // TODO - is there ever more than 1 attribution???
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
    var jsType = "undefined" !== typeof hCPU["script"] ? "script" : "unknown"; // spec changed from "script" to "unknown" Nov 2018
    if ("undefined" === typeof hCPU[jsType]) {
      // Initialize default values for pages that have *no Long Tasks*.
      hCPU[jsType] = 0;
      hCPUDetails[jsType] = "";
    }

    var hStats = cpuStats(hCPUDetails[jsType]);
    var sStats =
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
  function cpuStats(sDetails) {
    // tuples of starttime|duration, eg: ,456|250,789|250,1012|250
    var max = 0;
    var fci = getFcp(); // FCI is beginning of 5 second window of no Long Tasks _after_ first contentful paint
    // If FCP is 0 then that means FCP is not supported.
    // If FCP is not supported then we can NOT calculate a valid FCI.
    // Thus, leave FCI = 0 and exclude it from the beacon above.
    var bFoundFci = 0 === fci ? true : false;
    var aValues = [];
    var aTuples = sDetails.split(",");
    for (var i = 0; i < aTuples.length; i++) {
      var aTuple = aTuples[i].split("|");
      if (aTuple.length === 2) {
        var start = parseInt(aTuple[0]);
        var dur = parseInt(aTuple[1]);
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

    var count = aValues.length;
    var median = arrayMedian(aValues);

    return { count: count, median: median, max: max, fci: fci };
  }

  function calculateDCLS() {
    if ("function" !== typeof LayoutShift) {
      return false;
    }

    var DCLS = 0;

    for (var i = 0; i < gaPerfEntries.length; i++) {
      var p = gaPerfEntries[i];
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
  function arrayMedian(aValues) {
    if (0 === aValues.length) {
      return 0;
    }

    var half = Math.floor(aValues.length / 2);
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
    var sLuxjs = "";
    if (perf && perf.getEntriesByName) {
      // Get the lux script URL (including querystring params).
      var luxScript = getScriptElement("/js/lux.js");
      if (luxScript) {
        var aResources = perf.getEntriesByName(luxScript.src);
        if (aResources && aResources.length) {
          var r = aResources[0];
          // DO NOT USE DURATION!!!!!
          // See https://www.stevesouders.com/blog/2014/11/25/serious-confusion-with-resource-timing/
          var dns = Math.round(r.domainLookupEnd - r.domainLookupStart);
          var tcp = Math.round(r.connectEnd - r.connectStart); // includes ssl negotiation
          var fb = Math.round(r.responseStart - r.requestStart); // first byte
          var content = Math.round(r.responseEnd - r.responseStart);
          var networkDuration = dns + tcp + fb + content;
          var parseEval = LUX_t_end - LUX_t_start;
          var transferSize = r.encodedBodySize ? r.encodedBodySize : 0;
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
    var aIx = [];
    for (var key in ghIx) {
      aIx.push(key + "|" + ghIx[key]);
    }

    return aIx.join(",");
  }

  // _addData()
  function _addData(name, value) {
    dlog("Enter LUX.addData(), name = " + name + ", value = " + value);
    var typeN = typeof name;
    var typeV = typeof value;
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
      gCustomerDataTimeout = setTimeout(_sendCustomerData, 100);
    }
  }

  // _sample()
  // Return true if beacons for this page should be sampled.
  function _sample() {
    if ("undefined" === typeof gUid || "undefined" === typeof _samplerate) {
      return false; // bail
    }

    var nThis = ("" + gUid).substr(-2); // number for THIS page - from 00 to 99
    return parseInt(nThis) < _samplerate;
  }

  // Return a string of Customer Data formatted for beacon querystring.
  function customerDataValues() {
    var aData = [];
    for (var key in ghData) {
      var value = "" + ghData[key]; // convert to string (eg for ints and booleans)
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
    gFlags = gFlags | gFlag_InitCalled;

    // Mark the "navigationStart" for this SPA page.
    _mark(gStartMark);
  }

  // Return the number of blocking (synchronous) external scripts in the page.
  function blockingScripts() {
    var lastViewportElem = lastViewportElement();
    if (!lastViewportElem) {
      // If we can not find the last DOM element in the viewport,
      // use the old technique of just counting sync scripts.
      return syncScripts();
    }

    // Find all the synchronous scripts that are ABOVE the last DOM element in the
    // viewport. (If they are BELOW then they do not block rendering of initial viewport.)
    var aElems = document.getElementsByTagName("script");
    var num = 0;
    for (var i = 0, len = aElems.length; i < len; i++) {
      var e = aElems[i];
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
    var nBlocking = 0;
    var aElems = document.getElementsByTagName("link");
    for (var i = 0, len = aElems.length; i < len; i++) {
      var e = aElems[i];
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
    var aElems = document.getElementsByTagName("script");
    var num = 0;
    for (var i = 0, len = aElems.length; i < len; i++) {
      var e = aElems[i];
      if (e.src && !e.async && !e.defer) {
        // If the script has a SRC and async is false, then increment the counter.
        num++;
      }
    }

    return num;
  }

  // Return the number of external scripts in the page.
  function numScripts() {
    var aElems = document.getElementsByTagName("script");
    var num = 0;
    for (var i = 0, len = aElems.length; i < len; i++) {
      var e = aElems[i];
      if (e.src) {
        num++;
      }
    }
    return num;
  }

  // Return the number of stylesheets in the page.
  function numStylesheets() {
    var aElems = document.getElementsByTagName("link");
    var num = 0;
    for (var i = 0, len = aElems.length; i < len; i++) {
      var e = aElems[i];
      if (e.href && "stylesheet" == e.rel) {
        num++;
      }
    }
    return num;
  }

  function inlineTagSize(tagName) {
    var aElems = document.getElementsByTagName(tagName);
    var size = 0;
    for (var i = 0, len = aElems.length; i < len; i++) {
      var e = aElems[i];
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
    var s = "";
    var ns = _navigationStart;
    if (_getMark(gStartMark) && _getMark(gEndMark)) {
      // This is a SPA page view, so send the SPA marks & measures instead of Nav Timing.
      var start = Math.round(_getMark(gStartMark).startTime); // the start mark is "zero"
      ns += start; // "navigationStart" for a SPA is the real navigationStart plus the start mark
      const end = Math.round(_getMark(gEndMark).startTime) - start; // delta from start mark
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
      var t = perf.timing;
      var startRender = getStartRender(); // first paint
      var fcp = getFcp(); // first contentful paint
      var lcp = getLcp(); // largest contentful paint
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
    } else if (_getMark(gEndMark)) {
      // This is a "main" page view that does NOT support Navigation Timing - strange.
      const end = Math.round(_getMark(gEndMark).startTime);
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
      for (var arr = perf.getEntriesByType("paint"), i = 0; i < arr.length; i++) {
        var ppt = arr[i]; // PerformancePaintTiming object
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
      for (var i = gaPerfEntries.length - 1; i >= 0; i--) {
        var pe = gaPerfEntries[i];
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
      var t = perf.timing;
      var ns = t.navigationStart;
      var startRender;

      if (ns) {
        if (
          perf &&
          perf.getEntriesByType &&
          perf.getEntriesByType("paint") &&
          perf.getEntriesByType("paint").length
        ) {
          // If Paint Timing API is supported, use it.
          for (var arr = perf.getEntriesByType("paint"), i = 0; i < arr.length; i++) {
            var ppt = arr[i]; // PerformancePaintTiming object
            if ("first-paint" === ppt.name) {
              startRender = Math.round(ppt.startTime);
              break;
            }
          }
        } else if (window.chrome && "function" === typeof window.chrome.loadTimes) {
          // If chrome, get first paint time from `chrome.loadTimes`. Need extra error handling.
          var loadTimes = window.chrome.loadTimes();
          if (loadTimes) {
            startRender = Math.round(loadTimes.firstPaintTime * 1000 - ns);
          }
        } else if (t.msFirstPaint) {
          // If IE/Edge, use the prefixed `msFirstPaint` property (see http://msdn.microsoft.com/ff974719).
          startRender = Math.round(t.msFirstPaint - ns);
        }

        if (startRender > 0) {
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
    var luxScript = getScriptElement("/js/lux.js");
    if (luxScript) {
      LUX.customerid = getQuerystringParam(luxScript.src, "id");
      return LUX.customerid;
    }

    return "";
  }

  // Return the SCRIPT DOM element whose SRC contains the URL snippet.
  // This is used to find the LUX script element.
  function getScriptElement(urlsnippet) {
    var aScripts = document.getElementsByTagName("script");
    for (var i = 0, len = aScripts.length; i < len; i++) {
      var script = aScripts[i];
      if (script.src && -1 !== script.src.indexOf(urlsnippet)) {
        return script;
      }
    }

    return null;
  }

  function getQuerystringParam(url, name) {
    var qs = url.split("?")[1];
    var aTuples = qs.split("&");
    for (var i = 0, len = aTuples.length; i < len; i++) {
      var tuple = aTuples[i];
      var aTuple = tuple.split("=");
      var key = aTuple[0];
      if (name === key) {
        return aTuple[1];
      }
    }

    return undefined;
  }

  function avgDomDepth() {
    var aElems = document.getElementsByTagName("*");
    var i = aElems.length;
    var totalParents = 0;
    while (i--) {
      totalParents += numParents(aElems[i]);
    }
    var average = Math.round(totalParents / aElems.length);
    return average;
  }

  function numParents(elem) {
    var n = 0;
    if (elem.parentNode) {
      while ((elem = elem.parentNode)) {
        n++;
      }
    }
    return n;
  }

  function docHeight(doc) {
    var body = doc.body,
      docelem = doc.documentElement;
    var height = Math.max(
      body ? body.scrollHeight : 0,
      body ? body.offsetHeight : 0,
      docelem ? docelem.clientHeight : 0,
      docelem ? docelem.scrollHeight : 0,
      docelem ? docelem.offsetHeight : 0
    );
    return height;
  }

  function docWidth(doc) {
    var body = doc.body,
      docelem = doc.documentElement;
    var width = Math.max(
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
      var aEntries = performance.getEntriesByType("navigation");
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
    var c = navigator.connection;
    var connType = "";

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
    var aImages = document.getElementsByTagName("img");
    var aImagesAtf = [];
    if (aImages) {
      for (var i = 0, len = aImages.length; i < len; i++) {
        var image = aImages[i];
        if (inViewport(image)) {
          aImagesAtf.push(image);
        }
      }
    }

    return aImagesAtf;
  }

  // Return the last element in the viewport.
  function lastViewportElement(parent) {
    if (!parent) {
      // We call this function recursively passing in the parent element,
      // but if no parent then start with BODY.
      parent = document.body;
    }

    var lastChildInViewport;
    if (parent) {
      // Got errors that parent was null so testing again here.
      // Find the last child that is in the viewport.
      // Elements are listed in DOM order.
      var aChildren = parent.children;
      if (aChildren) {
        for (var i = 0, len = aChildren.length; i < len; i++) {
          var child = aChildren[i];
          if (inViewport(child)) {
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
  function inViewport(e) {
    var vh = document.documentElement.clientHeight;
    var vw = document.documentElement.clientWidth;

    // Return true if the top-left corner is in the viewport and it has width & height.
    var lt = findPos(e);
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
  function findPos(e) {
    var curleft = 0;
    var curtop = 0;

    while (e) {
      curleft += e.offsetLeft;
      curtop += e.offsetTop;
      e = e.offsetParent;
    }

    return [curleft, curtop];
  }

  // Beacon back the LUX data.
  function _sendLux() {
    dlog("Enter LUX.send().");

    var customerid = getCustomerId();
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

    var sUT = userTimingValues(); // User Timing data
    var sET = elementTimingValues(); // Element Timing data
    var sCustomerData = customerDataValues(); // customer data
    var sIx = ""; // Interaction Metrics
    if (!gbIxSent) {
      // It is possible for the IX beacon to be sent BEFORE the "main" window.onload LUX beacon.
      // Make sure we do not send the IX data twice.
      sIx = ixValues();
    }
    var sCPU = cpuTimes();
    var DCLS = calculateDCLS();
    var sLuxjs = selfLoading();
    if (document.visibilityState && "visible" !== document.visibilityState) {
      gFlags = gFlags | gFlag_NotVisible;
    }

    // We want ALL beacons to have ALL the data used for query filters (geo, pagelabel, browser, & customerdata).
    // So we create a base URL that has all the necessary information:
    var baseUrl =
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

    var is = inlineTagSize("script");
    var ic = inlineTagSize("style");

    var querystring =
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
    var sUT_remainder = "";
    if (sUT) {
      var curLen = baseUrl.length + querystring.length;
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
    var mainBeaconUrl = baseUrl + querystring;
    dlog("Sending main LUX beacon: " + mainBeaconUrl);
    _sendBeacon(mainBeaconUrl);

    // Set some states.
    gbLuxSent = 1;
    gbNavSent = 1;
    gbIxSent = sIx;

    // Send other beacons for JUST User Timing.
    const avail = gMaxQuerystring - baseUrl.length;
    while (sUT_remainder) {
      var sUT_cur = "";
      if (sUT_remainder.length <= avail) {
        // We can fit ALL the remaining UT params.
        sUT_cur = sUT_remainder;
        sUT_remainder = "";
      } else {
        // We have to take a subset of the remaining UT params.
        var iComma = sUT_remainder.lastIndexOf(",", avail); // as many UT tuples as possible
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

      var utBeaconUrl = baseUrl + "&UT=" + sUT_cur;
      dlog("Sending extra User Timing beacon: " + utBeaconUrl);
      _sendBeacon(utBeaconUrl);
    }
  }

  // Beacon back the IX data separately (need to sync with LUX beacon on the backend).
  function _sendIx() {
    var customerid = getCustomerId();
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

    var sIx = ixValues(); // Interaction Metrics

    if (sIx) {
      var sCustomerData = customerDataValues(); // customer data
      var querystring =
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
      var beaconUrl = _beaconUrl + querystring;
      dlog("Sending Interaction Metrics beacon: " + beaconUrl);
      _sendBeacon(beaconUrl);

      gbIxSent = 1;
    }
  }

  // Beacon back customer data that is recorded _after_ the main beacon was sent
  // (i.e., customer data after window.onload).
  function _sendCustomerData() {
    var customerid = getCustomerId();
    if (
      !customerid ||
      !gSyncId ||
      !validDomain() ||
      !_sample() || // OUTSIDE the sampled range
      !gbLuxSent // LUX has NOT been sent yet, so wait to include it there
    ) {
      return;
    }

    var sCustomerData = customerDataValues(); // customer data

    if (sCustomerData) {
      var querystring =
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
      var beaconUrl = _beaconUrl + querystring;
      dlog("Sending late Customer Data beacon: " + beaconUrl);
      _sendBeacon(beaconUrl);
    }
  }

  function _sendBeacon(url) {
    if (LUX.beaconMode !== "simple") {
      return _sendBeaconAutoUpdate(url);
    }

    new Image().src = url;
  }

  // Send a beacon that will also trigger the self-updating mechanism
  function _sendBeaconAutoUpdate(url) {
    var s1 = document.createElement("script");
    s1.async = true;
    s1.src = url;
    var aElems = document.getElementsByTagName("script");
    if (aElems.length) {
      aElems[0].parentNode.insertBefore(s1, aElems[0]);
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

  // Give a start element, return the first ancestor that has an ID AND the data-sctrack property.
  // If not found, return the first ancestor that has an ID.
  //   firstId - the first ID found crawling ancestors
  //   bAttrFound - true if an ancestor was found with the data-sctrack attribute
  function _findTrackedElement(elem, firstId, bAttrFound) {
    if (!elem || !elem.hasAttribute) {
      // No more ancestors. Return whatever we got. Might be undefined.
      return firstId;
    }

    if (elem.hasAttribute("data-sctrack")) {
      // Set the attribute flag.
      bAttrFound = true;
      if (elem.id) {
        // This MUST be the first time we have the attribute *AND* an ID,
        // so override any previous IDs (where the attribute had not yet been found).
        firstId = elem.id;
      }
    }

    if (!firstId && elem.id) {
      // If we've never found an ID, use this as the first one.
      firstId = elem.id;
    }

    if (bAttrFound && firstId) {
      // If we've found both, return
      return firstId;
    }

    return _findTrackedElement(elem.parentNode, firstId, bAttrFound);
  }

  function _scrollHandler() {
    // Leave handlers IN PLACE so we can track which ID is clicked/keyed.
    // _removeIxHandlers();
    if ("undefined" === typeof ghIx["s"]) {
      ghIx["s"] = Math.round(_now());
      // _sendIx(); // wait for key or click to send the IX beacon
    }
  }

  function _keyHandler(e) {
    _removeIxHandlers();
    if ("undefined" === typeof ghIx["k"]) {
      ghIx["k"] = Math.round(_now());

      if (e && e.target) {
        var trackId = _findTrackedElement(e.target);
        if (trackId) {
          ghIx["ki"] = trackId;
        }
      }
      _sendIx();
    }
  }

  function _clickHandler(e) {
    _removeIxHandlers();
    if ("undefined" === typeof ghIx["c"]) {
      ghIx["c"] = Math.round(_now());

      var target = null;
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
        var trackId = _findTrackedElement(e.target);
        if (trackId) {
          ghIx["ci"] = trackId;
        }
      }
      _sendIx();
    }
  }

  // This function is sometimes called by the /lux/ beacon response to
  // update the browser cache with the latest version of lux.js.
  function _doUpdate(newestVer, twiddle) {
    // If the newest version is newer than the browser cached version, then update.
    if (newestVer && version < newestVer && document.body && !gbUpdated) {
      dlog("Updating cached version of lux.js from " + version + " to " + newestVer + ".");
      // Since we're a SPA, it's possible that we could do an infinite number of self-updates
      // because lux.js would be refreshed, but it's not reloaded so "version" remains the same
      // until the next reload. To avoid infinite self-updates, set a flag so we only do it once.
      gbUpdated = 1;

      var luxScript = getScriptElement("/js/lux.js");
      if (luxScript) {
        if ("function" === typeof fetch) {
          // use fetch and cache:reload
          // see https://calendar.perfplanet.com/2017/clearing-cache-in-the-browser/
          fetch(luxScript.src, { cache: "reload" });
        } else {
          // old technique: use an iFrame that gets reloaded
          // see https://www.stevesouders.com/blog/2012/05/22/self-updating-scripts/
          var iframe1 = document.createElement("iframe");
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
  function addListener(eventName, callback) {
    if (window.addEventListener) {
      window.addEventListener(eventName, callback, false);
    } else if (window.attachEvent) {
      window.attachEvent("on" + eventName, callback);
    }
  }

  // Wrapper to support older browsers (<= IE8)
  function removeListener(eventName, callback) {
    if (window.removeEventListener) {
      window.removeEventListener(eventName, callback, false);
    } else if (window.detachEvent) {
      window.detachEvent("on" + eventName, callback);
    }
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
  function createSyncId(bInSampleBucket) {
    var syncId = bInSampleBucket
      ? Number(new Date()) + "00000" // "00" matches all sample rates
      : Number(new Date()) + "" + _padLeft(parseInt(100000 * Math.random()), "00000");
    return syncId;
  }

  // Unique ID (also known as Session ID)
  // We use this to track all the page views in a single user session.
  // If there is NOT a UID then set it to the new value (which is the same as the "sync ID" for this page).
  // Refresh its expiration date and return its value.
  function refreshUniqueId(newValue) {
    var uid = _getCookie("lux_uid");
    if (!uid || uid.length < 11) {
      uid = newValue;
    } else {
      // Prevent sessions lasting more than 24 hours.
      // The first 10 characters of uid is the epoch time when the session started.
      var uidStart = parseInt(uid.substring(0, 10));
      var now = Number(new Date()) / 1000; // in seconds
      if (now - uidStart > 24 * 60 * 60) {
        // older than 24 hours - reset to new value
        uid = newValue;
      }
    }

    setUniqueId(uid);

    return uid;
  }

  function setUniqueId(uid) {
    _setCookie("lux_uid", uid, gSessionTimeout);

    return uid;
  }

  // We use gUid (session ID) to do sampling. We make this available to customers so
  // they can do sampling (A/B testing) using the same session ID.
  function _getUniqueId() {
    return gUid;
  }

  // Return the current page label.
  function _getPageLabel() {
    if (typeof LUX.label !== "undefined") {
      return LUX.label;
    } else if (typeof LUX.jspagelabel !== "undefined") {
      try {
        var label = eval(LUX.jspagelabel);
      } catch (e) {
        console.log("Error evaluating customer settings LUX page label:", e);
      }

      if (label) {
        return label;
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

  function _getCookie(name) {
    try {
      // Seeing "Permission denied" errors, so do a simple try-catch.
      var aTuples = document.cookie.split(";");
      for (var i = 0; i < aTuples.length; i++) {
        var aTuple = aTuples[i].split("=");
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

  function _setCookie(name, value, seconds) {
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
  function _padLeft(str, padding) {
    return (padding + str).slice(-padding.length);
  }

  // Log messages/errors to console if enabled, or put in array.
  function dlog(msg) {
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

    // Send beacons in the UNLOAD handlers because the browser can UNLOAD before ONLOAD is called,
    // so this is our safety net to try to get some kind of beacon sent.
    // Set both unload and beforeunload in case one is not supported.
    addListener("beforeunload", _sendLux);
    addListener("unload", _sendLux);
    // If IX was already sent as part of sendLux, it will NOT get sent twice.
    // So it is okay to also add unload handlers for _sendIx:
    addListener("beforeunload", _sendIx);
    addListener("unload", _sendIx);
  }

  // Regardless of _auto, we need to register the IX handlers immediately.
  _addIxHandlers();

  // This is the public API.
  var _LUX = {
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
    cmd: function (args) {
      var fn = args.shift();
      if ("function" === typeof _LUX[fn]) {
        _LUX[fn].apply(_LUX, args);
      }
    },

    // properties
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

  // Process the command queue
  if (LUX.ac && LUX.ac.length) {
    LUX.ac.forEach(function (args) {
      var fn = args.shift();

      if ("function" === typeof _LUX[fn]) {
        _LUX[fn].apply(_LUX, args);
      }
    });
  }

  // process the error events that happened before lux.js got loaded
  if (typeof window.LUX_ae !== "undefined") {
    window.LUX_ae.forEach(function (error) {
      errorHandler(error);
    });
  }

  dlog("lux.js evaluation end.");

  return _LUX;
})();

var LUX_t_end = Date.now();
