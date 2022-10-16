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
5. Run `npm run build` to generate the latest bundles.
6. Copy `dist/lux.min.js` to [`rum-backend/js/lux.min.test.js`](https://github.com/SpeedCurve-Metrics/rum-backend/blob/main/js/lux.min.test.js)
7. Deploy rum-backend and check that the RUM data coming in from our test/beta accounts looks valid
8. Copy `dist/lux.min.js` to [`rum-backend/js/lux.min.js`](https://github.com/SpeedCurve-Metrics/rum-backend/blob/main/js/lux.min.js) and follow the documentation in the rum-backend repository to version the new script

## Publishing in GitHub Packages

This repo is used in `speedcurve-app` as an NPM package.
Package page: [lux.js](https://github.com/SpeedCurve-Metrics/lux.js/packages/1586797)

To publish a new version to [private GitHub Packages](https://github.com/orgs/SpeedCurve-Metrics/packages):
1. Navigate to your local version of the repo e.g. `cd ~/MyProjects/lux.js`
2. Add environment variable with personal access token from 1Password (search `GitHub Packages NPM personal access token`):
```
export NPM_AUTH_TOKEN="%token%"
```
3. Login to Github Packages with your Github user's credentials (or `speedcurve-bot`):
```
npm login --scope=@speedcurve-metrics --registry=https://npm.pkg.github.com
```
4. Run `npm publish`

Read more: [Working with the npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
