# lux.js changelog

## 2022-??-??: v300

This is considered a major lux.js release and may contain some breaking changes.

### Breaking changes

- `LUX.beaconMode` has been removed.
- `LUX.getDebug()` now returns a different format.

### Improvements

- Abandoned pages are now tracked by sending a beacon when the page state is **hidden**, rather than when the `unload` or `beforeunload` events are fired.
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
