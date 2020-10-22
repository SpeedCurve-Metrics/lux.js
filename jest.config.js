module.exports = {
  preset: "jest-puppeteer",
  testEnvironment: "./tests/environment.js",
  setupFilesAfterEnv: ["./tests/global-setup-after-env.js"],
  testTimeout: 10000,
};
