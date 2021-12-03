module.exports = {
  preset: "jest-puppeteer",
  testEnvironment: "./tests/environment.ts",
  setupFilesAfterEnv: ["./tests/global-setup-after-env.ts"],
  testTimeout: 10000,
};
