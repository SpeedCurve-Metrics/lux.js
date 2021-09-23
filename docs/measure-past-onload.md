# Measuring past onload with LUX

The onload event hasn't been a relevant measure of page performance -or even page completion- for many years. Yet out of the box, LUX uses it as a marker for when the page is complete. As a result, LUX does not measure performance for long enough on many pages.

## Goals

- Don't change the existing behaviour for current LUX users.
- Implement a variety of "measure until" markers that users can choose from.
- Set a better default marker for all new LUX users while retaining the existing behaviour for existing customers.
- Allow customers to pick their marker globally via the SpeedCurve UI, while allowing them to override it on a per-page basis.
- Have a suitable fallback for browsers that don't support the new markers.
- Implement a user-configurable timeout to use as a failover in the case where the marker is never reached.

## Proposed markers

### `LUX.measureUntil = "onload"`

The existing behaviour, driven by the global onload event handler.

### `LUX.measureUntil = "pagehidden"`

Wait until the visibilitychange event signals that the page has been hidden.

### `LUX.measureUntil = "cpuidle"`

Wait until there have been no long tasks for a number of miliseconds.

### `LUX.measureUntil = "networkidle"`

Wait until there have been no `fetch()` or XHR requests a number of miliseconds.

## Fallbacks

It's possible that any of these markers (including onload) can be delayed to the point where LUX collects "too much" data. It's also possible that the markers are never reached, for example when using `cpuidle`, a page might have no long tasks; or when using `visibilitychange`, a page might already be hidden.

### `LUX.maxMeasureTime = 60000`

Instruct LUX to measure for _no longer_ than a number of miliseconds. The default will be relatively high (1 minute?).

### `LUX.minMeasureTime = 5000`

Instruct LUX to measure for _at least_ a number of miliseconds. The default will be relatively low (5 seconds?). This setting is ignored for SPA pages (`LUX.auto = false`) since the developer will manually call `LUX.send()`.

### `LUX.sendBeaconOnPageHidden = true`

Instruct LUX to send the beacon when the page is hidden before the `measureUntil` marker is reached. This behaviour is enabled by default. For backwards-compatibility `LUX.auto = false` implies `LUX.sendBeaconOnPageHidden = false`. However it will be possible to do `LUX.auto = false; LUX.sendBeaconOnPageHidden = true;`. The logic would be:

```js
let autoMode = (typeof LUX.auto === "undefined") ? true : LUX.auto;
let sendBeaconOnPageHidden = (typeof LUX.sendBeaconOnPageHidden === "undefined") ? autoMode : LUX.sendBeaconOnPageHidden;
```

**Important:** This option will take priority over `LUX.minMeasureTime`, since we can't guarantee that the beacon will be sent after the page is hidden.

## Proposed defaults

All existing accounts will continue to have the existing defaults. In the `rum-backend` app, we can set new defaults based on the account creation date. These defaults would be:

```
LUX.auto = true;
LUX.measureUntil = "pagehidden";
LUX.minMeasureTime = 5000;
LUX.maxMeasureTime = 60_000;
LUX.sendBeaconOnPageHidden = true;
```

### Proposed defaults for "SPA mode"

We could implement a "SPA mode" checkbox in the SpeedCurve UI that essentially sets the following defaults:

```
LUX.auto = false;
LUX.maxMeasureTime = 60_000;
LUX.sendBeaconOnPageHidden = true;
```
