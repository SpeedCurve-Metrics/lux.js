# lux.js

This repository contains the source code for lux.js, SpeedCurve's real user monitoring (RUM) script.

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
7. Follow the [rum-backend release process]() to deploy the updated lux.js bundles.

## Publishing in GitHub Packages

This repo is used in `speedcurve-app` as an npm package.
Package page: [lux.js](https://github.com/SpeedCurve-Metrics/lux.js/packages/1586797)

To publish a new version to [private GitHub Packages](https://github.com/orgs/SpeedCurve-Metrics/packages):

1. Update the version in package.json to a semver-compatible version of the `SCRIPT_VERSION` constant. You may want to also run `npm version prerelease --preid=next` to mark the version as pre-release (this might be required to use a new version of lux.js in the SpeedCurve app before it's released on our CDN).
2. Add an environment variable with personal access token from 1Password (search `GitHub Packages npm personal access token`):

```
export NPM_AUTH_TOKEN="%token%"
```

3. Login to Github Packages with your Github user's credentials (or `speedcurve-bot`):

```
npm login --scope=@speedcurve-metrics --registry=https://npm.pkg.github.com
```

4. Run `npm publish`

Read more: [Working with the npm registry](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry)
