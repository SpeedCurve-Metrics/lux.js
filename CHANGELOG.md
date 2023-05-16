# lux.js changelog

## 2023-??-??: v308

### New features

- Pages that are [prerendered](https://web.dev/speculative-prerendering/) are now flagged as such.
- Pages that are restored from the [back-forward cache (bfcache)](https://web.dev/bfcache/) can now be tracked by setting `LUX.newBeaconOnPageShow = true`. [Read the documentation](https://support.speedcurve.com/docs/rum-js-api#luxnewbeacononpageshow) for more information on how this works.
- Server timing metrics are now extracted from the main page response. Metrics must be configured in your SpeedCurve settings before they are collected.

### Improvements

- The beacon will no longer be sent automatically if the page visibility is hidden. This can be overridden by setting `LUX.trackHiddenPages = true`.
- All metrics on prerendered pages are now relative to `activationStart`.
- Navigation timing values with a value of zero are now reported, rather than ignored.
- The legacy `domLoading` metric is no longer collected.
- The first paint event of any type will be considered for start render, rather than just first-paint events.

### Bug fixes

- Timing values are now rounded down to the nearest unit to prevent values from being rounded into the future.

## 2023-04-03: v307

### New features

- [Session windows](https://web.dev/evolving-cls/) have been implemented for the CLS metric. This may reduce CLS scores on long-lived pages.

### Bug fixes

- INP is now reset when `LUX.init()` is called.
- Fixed a bug where INP could be recorded twice for a single page view.
- Ignore first-input entries for INP when there is a matching event entry.

### Improvements

- The code that determines the page label based on [Page Label URL Rules](https://support.speedcurve.com/docs/rum-page-labels#page-label-url-rules) has been optimized, reducing the size of lux.js.

## 2023-03-20: v306

### New features

- The experimental [Interaction to Next Paint (INP) metric](https://web.dev/inp/) is now collected.

### Improvements

- Custom data is now only sent when it has been updated. This reduces beacon size and prevents unnecessary beacons from being sent.

### Bug fixes

- Calling `LUX.init()` will now reset FID between SPA page views. Previously the first FID value was recorded for all subsequent SPA page views.
- Element timing values in SPA pages are now relative to the most recent `LUX.init` call rather than relative to navigationStart.
- Fixed a bug where pages with many user timing entries did not have their path or domain recorded.
- Largest Contentful Paint is now measured as the time since activationStart, not navigationStart. This means LCP will be correctly recorded as zero for prerendered pages.

## 2022-11-30: v305

### Bug fixes

- Split user timing entries across multiple beacons when necessary to prevent data loss.

## 2022-10-11: v304

### Bug fixes

- Prevent a TypeError from being thrown when an interaction event is triggered with a target that is not an `Element`.

## 2022-10-11: v303

### Bug fixes

- Fixed a bug where page group URL matching didn't work on exact path matches

## 2022-10-11: v302

### Improvements

- The start time of user timing measures is now recorded. In previous versions of lux.js only the duration was recorded.
- Keyboard interaction tracking is now done by listening for the `keydown` event instead of the deprecated `keypress` event.
- Custom data variables can now be removed by specifying their value as `null` or `undefined`. For example `LUX.addData("var1", null)` or `LUX.addData("var1", undefined)` will both remove any previously-set values for `var1`.
- `LUX.markLoadTime` now accepts an optional `time` parameter. For example `LUX.markLoadTime(200)` will record the load time for a SPA page view as 200 ms.

### Bug fixes

- `LUX.mark()` and `LUX.measure()` are now fully compatible with their native counterparts `performance.mark()` and `performance.measure()`. In previous versions of lux.js these functions did not support an options object as the second parameter.
- Interaction element attribution for elements with the `data-sctrack` attribute has been fixed. In previous version of lux.js the `data-sctrack` attribute only took priority on the element that was interacted with. It now takes priority even when it has been set on an ancestor element. See [the `data-sctrack` documentation](https://support.speedcurve.com/docs/rum-js-api#data-sctrack) for more information.
- `LUX.label` is now ignored if the value is falsey.
- FID values of <0.5ms are now reported as zero instead of ignored.

### Other

- Some legacy vendor-specific code has been removed: lux.js no longer uses `chrome.loadTimes()` or any `performance.webkit*` functions. Browsers that supported these vendor functions will now use polyfills or fallbacks.

## 2022-04-25: v301

### New features

- The synthetic onload time for SPAs can be marked with `LUX.markLoadTime()`, allowing `LUX.send()` to be called later in the page lifecycle.
- Added the [SpeedCurve RUM Debug Parser](https://speedcurve-metrics.github.io/lux.js/debug-parser.html) to help interpret the debug messages.
- `LUX.getDebug()` now includes events that help to debug some metrics including LCP, CLS, element timing, and long tasks.
- Source maps are now available for lux.js.

### Bug fixes

- Fixed a bug where JavaScript errors were only tracked on the first SPA page view.

## 2022-02-22: v300

This is considered a major lux.js release and may contain some breaking changes.

### Breaking changes

- `LUX.beaconMode` has been removed.
- `LUX.getDebug()` now returns a different format.

### New features

- The [pathname](https://developer.mozilla.org/en-US/docs/Web/API/Location/pathname) of the current page is now tracked.
- JavaScript error tracking can be disabled by setting `LUX.errorTracking = false`.
- The maximum number of JavaScript errors tracked per page view can be controlled with `LUX.maxErrors = <number>`.
- The maximum measure time can be controlled by setting `LUX.maxMeasureTime = <number>`. After this time, data collection will stop and the beacon will automatically be sent. This can be useful to prevent dynamic content like adverts from affecting your CLS and LCP scores late in the page load. The time is specified in milliseconds, and the default value is `60_000` (1 minute).

### Improvements

- An `unload` handler is no longer used to track abandoned pages, except in legacy web browsers. The `visibilitychange` and `pagehide` events are used instead.
- Developers who implement lux.js into a SPA by using `LUX.auto = false` can now opt-in to abandoned page tracking by setting `LUX.sendBeaconOnPageHidden = true`.

### Bug fixes

- Calling `LUX.init()` on the initial page load will no longer lose previously-captured data.

## 2021-06-21: v216

- Long tasks buffering (which was previously reverted in v214) has been reinstated, enabling LUX to instrument long tasks that occurred before the snippet.
- JavaScript page labels are now evaluated quicker than before.
- Fixed a bug where `LUX.beaconMode = "simple"` was not honoured when `LUX.auto = false`.

## 2021-04-30: v214

- This is a hotfix release that reverts long task buffering. An error in the PerformanceObserver logic caused early entries of all types (including paint, largest-contentful-paint, and layout-shift) to be dropped.

## 2021-04-29: v213

- Long tasks are now buffered, enabling LUX to instrument long tasks that occurred before the snippet.
- User interaction times in a SPA are now relative to the most recent `LUX.init` call, rather than relative to navigationStart.
- Element identifiers for user interaction (click, keypress) have been improved. Buttons and links that don't have an id attribute will use their text content as the identifier.

## 2021-01-14: v211

- Calling `LUX.init()` no longer causes all user timing marks & measures to be cleared.

## 2020-12-15: v210

- Add `LUX.beaconMode = "simple"` to disable LUX's auto-updating mechanism.

## 2020-12-03: v209

- Fixed a bug where JavaScript page labels were being ignored in some cases.

## 2020-11-03: v208

- User timing marks in SPAs are now measured since the last `LUX.init` call. Previously they were measured since the beginning of the initial page load, causing user timing values in subsequent pages to be much higher than expected.
- Fixed a bug where JavaScript page labels only work when the variable is defined before LUX is loaded.
- Fixed a bug where SPAs that didn't set a page label would always use the initial `document.title` value as the page label. Now the page label is updated whenever `document.title` changes.

## 2020-07-12: v206

- Start render measurements that occur after the document onload event are no longer ignored.
- The event listeners used to measure FID are now explicitly bound to the global scope to work around a Chrome bug affecting some instrumentation libraries [like Sentry](https://github.com/getsentry/sentry-javascript/issues/2074).
