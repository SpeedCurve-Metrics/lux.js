# LUX "v2" usage changes

## General API changes

### New method: `LUX.configure`

It's common for LUX configuration to be specified all at once. This method aims to make the API for configuring LUX more consistent. For example, this mixture of setting properties and calling methods...

```js
LUX.auto = false;
LUX.label = "Home";
LUX.addData("tvMode", 1);
LUX.addData("env", "prod");
```

... Could instead be written as one configuration object:

```js
LUX.configure({
    auto: false,
    label: "Home",
    data: {
        tvMode: 1,
        env: "prod",
    },
});
```

### New parameter: `LUX.send(configuration)`

It's common for things like page labels and customer data to be specified at the same place that `LUX.send` is called. An optional object parameter to `LUX.send` would be the equivalent to calling `LUX.configure(options)` immediately followed by `LUX.send()`.

```js
LUX.send({
    label: "Home",
    data: {
        tvMode: 1,
        env: "prod",
    },
});
```

### New property: `LUX.measureUntil = <UntilValue>`

Controls when the beacon is sent in "auto" mode. Possible values are:

* `pagehidden` - wait until the page's `visibilityState` is `hidden`, with `pagehide` and `unload` fallbacks

Future versions of LUX might also support `networkidle`, which would employ heuristics to send the beacon when all network requests have completed; `cpuidle`, which would wait until there are no more long tasks; and `idle` which is a combination of both.

### New property: `LUX.maxTimeAfterOnload = <TimeoutInMs>`

Controls the maximum time to wait after the onload event before the beacon is sent. Default value is `10000` (10 seconds). Can be set to `0` to wait indefinitely (not recommended).

### New method: `LUX.markLoadTime()`

Marks the "onload" time for SPA page views. Enables an accurate onload time to be recorded without sending the beacon too early.

## "Normal" (non-SPA) usage

### Current usage in "auto" mode

No changes. By default LUX will continue to measure until onload.

### Send the beacon automatically after measuring for as long as possible

This is a new "mode" for LUX where we continue collecting data. Metrics like LCP, CLS, and long tasks will be affected by this.

```js
LUX.measureUntil = "pagehidden";
```

## SPA-specific changes

### Current usage

No changes. `LUX.init` and `LUX.send` will continue to work as they do now.

```js
LUX.auto = false;

// Manually send the beacon as soon as the page has loaded
MyApp.onPageLoaded(() => {
    LUX.send();
});

// Manually reset LUX at the point where the user initiates a navigation
MyApp.onUserNavigation(() => {
    LUX.init();
    loadNextPage();
});
```

### Proposal #1

### Mark the "onload" time without sending the beacon, then send the beacon as late as possible

This is similar to the current usage, however the onload time measurement is split from the beacon sending. This allows for data to be collected for as long as possible. Metrics like LCP and long tasks will be affected by this.

```js
LUX.auto = false;

// Automatically send the beacon when the page is hidden
LUX.measureUntil = "pagehidden";

// Manually mark when the page is loaded
onPageLoaded(() => {
    LUX.markLoadTime();
});

// Manually send the beacon and reset LUX at the point where the user initiates a navigation
onUserNavigation(() => {
    LUX.send();
    LUX.init();
    loadNextPage();
});
```

### Mark the "onload" time without sending the beacon, send the beacon as late as possible, and automatically send the beacon

This is similar to the current usage, however the onload time measurement is split from the beacon sending. This allows for data to be collected for as long as possible. Metrics like LCP and long tasks will be affected by this.

```js
// Measure until the page is hidden, up to a maximum of 10 seconds after onload
LUX.measureUntil = "pagehidden";
LUX.maxTimeAfterOnload = 10000;

LUX.auto = false;

// Measure until the network is idle for 5 seconds
LUX.measureUntil = "networkidle";
LUX.idleTime = 5000;

// Measure until long tasks are idle for 5 seconds
// What would we do for browsers that don't support long tasks?
LUX.measureUntil = "cpuidle";
LUX.idleTime = 5000;

// Measure until everything (CPU & network) is idle for 5 seconds
LUX.measureUntil = "idle";
LUX.idleTime = 5000;



LUX.auto = false;

// Manually mark when the page is loaded
onPageLoaded(() => {
    LUX.markLoadTime();
});

// Manually send the beacon and reset LUX at the point where the user initiates a navigation
onUserNavigation(() => {
    LUX.send();
    LUX.init();
    loadNextPage();
});
```
