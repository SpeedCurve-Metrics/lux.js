# lux.js SPA improvements

## Executive summary: Potential solutions

Adding a "SPA mode" in the RUM Settings UI would be the easiest way to simplify SPA implementations. It requires the smallest change to lux.js and allows us to change implementation details on a per-customer level without making further lux.js changes.

Adding more methods to the `LUX` API is a middle-ground kind of solution that gives implementers more control but does not significantly reduce complexity.

We should aspire to completely automate SPA implementations, possibly with the help of Chromium's soft navigation work, but mostly aiming for a generic cross-browser solution. This would be a large undertaking and require a lot of testing and validation with customers.

## The problem (high level)

### Implementing lux.js in a SPA requires knowledge of various config items and methods

Much of the internal lux.js architecture is designed around full page navigations. SPA support was an afterthought, and setting `LUX.auto = false` essentially puts lux.js into "full manual control" mode.

A proper lux.js implementation in a SPA requires correctly use of `LUX.auto`, `LUX.sendBeaconOnPageHidden`, `LUX.init()`, `LUX.markLoadTime()`, and `LUX.send()`. Getting just one of these wrong can throw the whole implementation off.

### Many implementations seem to be incorrect, resulting in lost data and mistrust in SpeedCurve's metrics

The most common most of failure for lux.js in SPAs is `LUX.send()` being called too soon. Despite many documentation tweaks and hand holding, this still happens regularly.

The other common issue is that SpeedCurve's "Page Load" metric is the same for full page navigations and soft navigations. Most implementations do not use `LUX.markLoadTime()`, so most soft navigation Page Load time is set when `LUX.send()` is called.

### It is difficult to debug lux.js implementations from the outside

The internal lux.js logs (from `LUX.getDebug()`) do not always expose enough information to determine whether an implementation is correct. Sometimes the only way to know is by reviewing the actual implementation.

### We get one shot for a good implementation

Once a lux.js implementation is deployed, it is difficult to get customers to change it. Most of the time we only get one shot.

## Finding a solution

### Current capabilities

- All of the low level APIs required for a good SPA implementation already exist in lux.js.
- rum-backend is capable of injecting most `LUX` config values based on SpeedCurve account settings.

### Limitations

- The lux.js API is append-only. We can add things (new methods, new method parameters) but we can never change things (swap method parameter order, rename methods). We can also never remove things. Anything we add must be well thought-out, or we will compromise our goal of having the smallest and fastest RUM SDK.

## Solution #1: SPA mode

### Overview

- Add a "SPA mode" toggle in the SpeedCurve RUM Settings UI.
- Add a new method to indicate the beginning of a soft navigation.
- Remove the Page Load metric from soft navigations unless `LUX.markLoadTime()` is explicitly called.

### Pros

- Gives SpeedCurve full control over the implementation without needing to release lux.js updates.
- No risk of misconfiguration, requires just one function call on soft navigation.
- Gives SpeedCurve valuable data about how many RUM customers use SPA mode.
- We can change what SPA mode does per-customer based on their other settings.
- Only one new API method that has low risk of becoming redundant or deprecated.
- Backwards compatible with existing implementations.
- Remove confusion around the Page Load metric.

### Cons

- Requires a new API method.
- Implementers are forced to choose one extreme or the other: full manual control (`LUX.auto = false`) or full autopilot.
- Does not fix the fundamental issues with lux.js architecture.

### Technical details

#### SPA mode

When "SPA mode" is enabled, we will automatically inject the appropriate `LUX` config into lux.js. This may be something like:

```js
// Don't send the beacon on onload
LUX.auto = false;

// Do send the beacon on pagehide
LUX.sendBeaconOnPageHidden = true;

// Do enable bfcache support
LUX.newBeaconOnPageShow = true;
```

#### Soft navigation API

A new method would be called when the user initiates a soft navigation. This is the only "hard implementation" that lux.js implementers would be required to do. Under the hood, this method would essentially be:

```js
function beginSoftNavigation() {
    // Send the beacon for the current (previous?) navigation
    LUX.send();

    // Initialise a new beacon for the upcoming soft navigation
    LUX.init();
}
```

Taking inspiration from [the "V2" Usage Changes document](./usage-changes.md), this new method could also take a config object and apply it to the upcoming soft navigation:

```js
LUX.beginSoftNavigation({
    label: "cart.checkout",
    data: {
        cart_size: 24,
        cart_value: 804.2,
        user_type: "guest",
    },
});
```

## Solution #2: More high-level APIs

### Overview

In contrast to solution #1, this solution would be done completely with "hard implementation", but add more to the `LUX` API to reduce implementation friction. For example:

```js
// During bootstrap / init
LUX.enableSPAMode();

// When user initiates a soft navigation
LUX.beginSoftNavigation();

// When loading is complete
LUX.endSoftNavigation(); // alias for LUX.markLoadTime()
```

This solution would also get rid of the Page Load metric for soft navigations (unless `LUX.markLoadTime()` is called).

### Pros

- Gives implementers control without forcing them to use "full manual mode" (`LUX.auto = false`).
- We can change what SPA mode does in future lux.js releases.
- Specific SPA-related APIs clarify implementer intent.
- Remove confusion around the Page Load metric.

### Cons

- Does not allow for per-account implementation tweaks.
- Adds at least 3 new methods to the `LUX` API, increasing risk of redundancy or deprecation.
- Some risk of misconfiguration if `LUX.enableSPAMode()` is not called at the correct time.

### Technical details

The new APIs might be implemented as such:

```js
function enableSPAMode() {
    LUX.auto = false;
    LUX.sendBeaconOnPageHidden = true;
    LUX.newBeaconOnPageShow = true;
}

function beginSoftNavigation() {
    LUX.send();
    LUX.init();
}

function endSoftNavigation() {
    LUX.markLoadTime();
}
```
