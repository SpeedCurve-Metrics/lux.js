# lux.js changelog

## 2025-05-26: v4.1.2

### Improvements

- Minification optimizations have reduced the output size.

### Other

- Invoker and source function name have been removed from LoAF entries to reduce payload size.

## 2025-04-08: v4.1.1

### Bug fixes

- Limit the number of LoAF entries and script attribution to prevent large beacon payloads.
- Better handling for legacy browsers that do not support `URLSearchParams`.

## 2025-04-08: v4.1.0

### New features

- Long Animation Frame (LoAF) data is now collected, including script attribution for INP.

### Improvements

- LCP, CLS, and INP are now calculated right before the beacon is sent rather than when events are received.

## 2025-03-21: v4.0.32

### Bug fixes

- Prevent legacy browsers throwing `URLSearchParams is undefined`
- Avoid cross frame property access errors

## 2025-03-20: v4.0.31

### New features

- Automatically send UTM parameters as custom data. The variable names are: `_utm_source`, `_utm_campaign`, `_utm_medium`, `_utm_term`, and `_utm_content`. These must be configured as **Custom Data Dimensions** in your [SpeedCurve Settings](https://app.speedcurve.com/settings/custom-data/) to show in your dashboards.

### Bug fixes

- Ensure the event type is always present for INP attribution.

## 2025-02-04: v4.0.30

### Bug fixes

- Limit the number of CLS attribution sources to prevent large beacon payloads.
- Prevent generating element selectors that are longer than the maximum size.

## 2025-01-13: v4.0.29

### Other

- Remove `LUX.enablePostBeacon` configuration item.

## 2024-11-04: v4.0.28

### Bug fixes

- Fix bug where in some rare cases a negative INP or LCP value could be reported.

## 2024-09-19: v4.0.27

### Bug fixes

- Fix bug where custom data values that were changed to `null` after previously being non-null were not being removed from the beacon.

## 2024-08-26: v4.0.26

### New features

- Capture the [`deliveryType`](https://developer.mozilla.org/en-US/docs/Web/API/PerformanceResourceTiming/deliveryType) of the document.

### Bug fixes

- Fix bug that prevented multiple lux.js instances from running on the same page.

## 2024-07-24: v4.0.25

### Bug fixes

- Ensure POST beacon is sent when `LUX.init()` is called on pages where `LUX.auto = true`.
- Prevent zero LCP values from being sent in the POST beacon.

## 2024-07-23: v4.0.24

### Bug fixes

- Fix POST beacon counting `maxMeasureTime` from beacon initialization time, rather than navigation start.

## 2024-07-12: v4.0.23

### Bug fixes

- Fix a bug where the beacon is retried on report-only CSP violations.

## 2024-07-11: v4.0.22

### Improvements

- CSP violations caused by the new beacon are automatically caught, and the beacon is retried on the same domain as the original beacon.

## 2024-07-03: v4.0.21

### Bug fixes

- Attempt to fix `ReferenceError: Can't find variable: performance` errors in some older browsers.

## 2024-07-01: v4

🎉 Version 4 of lux.js signifies a major change in the way metrics will be collected moving forward.

Prior to v4, lux.js collected metrics until the `onload` event was fired (or until `LUX.minMeasureTime` elapsed, whichever occurred later), and a beacon was sent immediately afterwards. Any metrics that occurred after the beacon was sent were ignored. This mainly affected metrics that could change throughout the lifecycle of a page, for example Largest Contentful Paint (LCP), Interaction to Next Paint (INP), and Cumulative Layout Shift (CLS).

With lux.js v4, the original beacon will still be sent. However a second beacon will continue to collect LCP, INP, and CLS until the `pagehide` event or until 60 seconds after the page load began - whichever happens first. This will bring SpeedCurve RUM in line with other tools like the Chrome User Experience Report (CrUX) and the web-vitals JavaScript library.

The first release of lux.js v4 is v4.0.20.

## 2024-05-15: v316

### Bug fixes

- Prevent "Converting circular structure to JSON" errors when some INP events are received.
- Prevent trying to access `nodeName` on `null` values.

## 2024-05-15: v315

### New features

- Add `LUX.interactionBeaconDelay` to control how long lux.js waits before sending the interaction beacon. This defaults to 200ms, but can be increased on pages that have very slow event handlers. Increasing the delay will improve INP collection but may result in data loss if users abandon the page before the beacon is sent.

### Improvements

- When duplicate INP entries are encountered, the one with the longest processing time is picked.
- INP entries are now included in the debug log.
- The config object is copied before being added to the debug log to reflect the fact that config changes after initialization have no effect.
- The Debug Parser now shows Core Web Vitals metrics in the beacon details.
- Interaction beacons have a slightly longer delay before being sent to allow for long INP entries to be picked up.

### Bug fixes

- Fixed a bug where element selector string could be too long.

## 2024-04-25: v314

### New features

- INP diagnostic information is now collected. This includes the INP element selector, the INP event start time, and the input delay, processing time, and presentation delay sub-parts.

### Improvements

- Add `LUX.cookieDomain` to control which domain the user session cookie is stored on. This is useful for tracking user sessions across subdomains.
- Interaction element attribution has been changed. Please see [the data-sctrack documentation](https://support.speedcurve.com/docs/rum-js-api#data-sctrack) for more information.

### Bug fixes

- Pages that had a scroll interaction before a click or keypress interaction will now report the click or keypress as the main interaction. Previously the scroll was being reported as the main interaction.

## 2024-02-24: v313

### Improvements

- `LUX.getDebug()` now includes the LUX configuration at init time.

### Bug fixes

- The `InitCalled` flag is no longer set for bfcache restores, unless it was already set on the page being restored.

## 2023-10-11: v312

### Bug fixes

- Fix an edge case where a beacon is not sent if the page was hidden when it started loading.
- Fix an edge case where some FID values were recorded as floats.

## 2023-08-22: v311

### Bug fixes

- Fix a script error in Internet Explorer.

## 2023-08-22: v310

### Improvements

- Pressing a modifier key on its own will no longer be tracked as a user interaction.
- Smarter handling of navigation timing metrics with a value of zero. Some metrics will now only be reported as zero on cached and prerendered pages.

### Bug fixes

- Redirect time is no longer reported for pages restored from the back-forward cache.

## 2023-06-06: v309

### Bug fixes

- Use the maximum session value for CLS, not the latest session value.

## 2023-05-25: v308

### New features

- Pages that are [prerendered](https://web.dev/speculative-prerendering/) are now flagged as such.
- Pages that are restored from the [back-forward cache (bfcache)](https://web.dev/bfcache/) can now be tracked by setting `LUX.newBeaconOnPageShow = true`. [Read the documentation](https://support.speedcurve.com/docs/rum-js-api#luxnewbeacononpageshow) for more information on how this works.
- Server timing metrics are now extracted from the main page response. Metrics must be configured in your SpeedCurve settings before they are collected.

### Improvements

- The beacon will no longer be sent automatically if the page visibility is hidden. This can be overridden by setting `LUX.trackHiddenPages = true`.
- All metrics on prerendered pages are now relative to `activationStart`.
- Navigation timing metrics with a value of zero are now reported, rather than ignored.
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
