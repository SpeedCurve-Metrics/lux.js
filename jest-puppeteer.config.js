module.exports = {
  server: {
    command: "node tests/server.js > server.log",
    port: 3000,
    usedPortAction: "kill",
  },
};
