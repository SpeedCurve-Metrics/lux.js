# SPA Mode in lux.js

## Migrating from `LUX.auto = false`

- Remove `LUX.auto = false`.
- Remove all `LUX.send()` calls. In SPA mode, the beacon is sent automatically. In some very rare cases you may want to send the beacon manually, which can be done by calling `LUX.send(true)` - **this is not recommended**.
- Replace all `LUX.init()` calls with `LUX.startSoftNavigation()`.
