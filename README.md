# lux.js

This repository contains the source code for lux.js, SpeedCurve's real user monitoring (RUM) script.

## Local development

- Compile the lux.js script with `npm run build` or `npm run watch`
- Run the tests with `npm run jest` or `npm run jest-watch`
- Check for linting errors with `npm run lint` and automatically fix them (where possible) with `npm run lint-fix`

## Release process

1. Propose changes in a pull request
2. Once approved, merge changes to the `main` branch
3. Increment the `SCRIPT_VERSION` constant on the `main` branch
4. Create a new release in GitHub, following the naming convention and documentation process of previous releases
5. Copy `dist/lux.min.js` to [`rum-backend/js/lux.min.test.js`](https://github.com/SpeedCurve-Metrics/rum-backend/blob/main/js/lux.min.test.js)
6. Deploy rum-backend and check that the RUM data coming in from our test/beta accounts looks valid
7. Copy `dist/lux.min.js` to [`rum-backend/js/lux.min.js`](https://github.com/SpeedCurve-Metrics/rum-backend/blob/main/js/lux.min.js) and follow the documentation in the rum-backend repository to version the new script
