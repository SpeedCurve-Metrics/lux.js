module.exports = {
  exitOnPageError: false,
  launch: {
    headless: process.env.HEADLESS !== "false",
  },
  server: {
    command: "node tests/server.mjs > server.log",
    port: 3000,
    usedPortAction: "kill",
  },
};
