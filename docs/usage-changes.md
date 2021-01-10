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

### New method: `LUX.sendBeaconAfter(option)`

Controls when the beacon is sent in "auto" mode. Possible values are:

* `onload` - the same behaviour as `LUX.auto = true`
* `pagehidden` - wait until the page's `visibilityState` is `hidden`, with `pagehide` and `unload` fallbacks

Future versions of LUX might also support a `networkidle` value, which would employ heuristics to send the beacon when all network requests have completed.

### New method: `LUX.markLoadTime()`

Marks the "onload" time for SPA page views. Enables an accurate onload time to be recorded without sending the beacon too early.

## "Normal" (non-SPA) usage

### Current usage in "auto" mode

No changes. By default LUX will continue to measure until onload.

### Send the beacon automatically after measuring for as long as possible

This is a new "mode" for LUX where we continue collecting data. Metrics like LCP, CLS, and long tasks will be affected by this.

```js
LUX.sendBeaconAfter("pagehidden");
```

## SPA-specific changes

### Current usage

No changes. `LUX.init` and `LUX.send` will continue to work as they do now.

```js
LUX.auto = false;

// Manually send the beacon as soon as the page has loaded
onPageLoaded(() => {
    LUX.send();
});

// Manually reset LUX at the point where the user initiates a navigation
onUserNavigation(() => {
    LUX.init();
    loadNextPage();
});
```

### Mark the "onload" time without sending the beacon, then send the beacon as late as possible

This is similar to the current usage, however the onload time measurement is split from the beacon sending. This allows for data to be collected for as long as possible. Metrics like LCP and long tasks will be affected by this.

```js
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
