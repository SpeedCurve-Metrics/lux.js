# lux.js - real user monitoring

![](https://flat.badgen.net/bundlephobia/minzip/@speedcurve/lux)
![](https://flat.badgen.net/bundlephobia/min/@speedcurve/lux)

This repository contains the source code for lux.js, [SpeedCurve's real user monitoring (RUM)](https://www.speedcurve.com/) script.

## How to use lux.js

1. [Sign up for a SpeedCurve account](https://www.speedcurve.com/)
2. Go to the **Settings** page and scroll to the bottom of the page
3. Click on **Edit RUM**
4. Click on the **JS Snippet** tab
5. Copy the RUM JS snippet into the `<head>` of your page

> ⚠️ Self-hosting lux.js is not recommended. Please read our [self-hosting documentation](https://support.speedcurve.com/docs/self-hosted-real-user-monitoring) for more information.

## Configuring lux.js

See [the lux.js API documentation](https://support.speedcurve.com/docs/rum-js-api).

## Using lux.js in a SPA

See [the SPA documentation](https://support.speedcurve.com/docs/single-page-applications).

## Project goals

1. **Browser compatibility** - lux.js runs and gathers basic metrics in every browser that supports ES3, while still gathering modern metrics from evergreen browsers.
2. **Small size** - lux.js aims to be under 10 KB when minified and compressed.
3. **Low overhead** - lux.js creates only a handful of event handlers and observers. Most metrics are calculated on-demand before a beacon is sent.

## Local development

- Compile the lux.js script with `npm run build` or `npm run watch`
- Run the tests with `npm run test`
- Check for linting errors with `npm run lint` and automatically fix them (where possible) with `npm run lint-fix`

## Release process

1. Propose changes in a pull request
2. Once approved, merge changes to the `main` branch
3. Increment the `SCRIPT_VERSION` constant on the `main` branch
4. Add release information into CHANGELOG.md in this repo
5. Create a new release in GitHub, following the naming convention and documentation process of previous releases
6. Run `npm run build` to generate the lux.js bundles.
7. Follow the rum-backend release process to deploy the updated lux.js bundles.
