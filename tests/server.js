const { createServer } = require("http");
const { readFile } = require("fs/promises");
const { readFileSync } = require("fs");
const path = require("path");
const url = require("url");

const testPagesDir = path.join(__dirname, "test-pages");
const distDir = path.join(__dirname, "..", "dist");

const headers = (contentType) => ({
  "content-type": contentType,
  connection: "close",
});

const server = createServer(async (req, res) => {
  const inlineSnippet = readFileSync(path.join(distDir, "lux-snippet.js"));
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  console.log(`[${req.method}] ${parsedUrl.pathname}`);

  const filePath = path.join(testPagesDir, pathname);
  let contentType = "text/html";

  switch (path.extname(pathname)) {
    case ".js":
      contentType = "application/javascript";
      break;

    case ".png":
      contentType = "image/png";
      break;
  }

  if (pathname === "/js/lux.js") {
    const contents = await readFile(path.join(distDir, "lux.min.js"));
    let preamble = `LUX=window.LUX||{};LUX.beaconUrl='http://localhost:${SERVER_PORT}/beacon/';LUX.errorBeaconUrl='http://localhost:${SERVER_PORT}/error/';`;

    res.writeHead(200, headers(contentType));
    res.end(preamble + contents);
  } else if (pathname == "/beacon/" || pathname == "/error/") {
    res.writeHead(200, headers("image/webp"));
    res.end();
  } else {
    try {
      let contents = await readFile(filePath);

      if (contentType === "text/html") {
        let injectScript = `
          window.createLongTask = (duration = 50) => {
              const startTime = performance.now();
              const random = Math.random() * 10;

              while (performance.now() < startTime + duration + random) {
                  // Block the main thread for the specified time
              }
          };
        `;

        if (!parsedUrl.query.noInlineSnippet) {
          injectScript += inlineSnippet;
        }

        if (parsedUrl.query.injectScript) {
          injectScript += parsedUrl.query.injectScript;
        }

        contents = contents.toString().replace("/*INJECT_SCRIPT*/", injectScript);
      }

      const sendResponse = () => {
        res.writeHead(200, headers(contentType));
        res.end(contents);
      };

      if (parsedUrl.query.delay) {
        setTimeout(sendResponse, parseInt(parsedUrl.query.delay));
      } else {
        sendResponse();
      }
    } catch (e) {
      console.error(e);
      res.writeHead(404);
      res.end("Not Found");
    }
  }
});

const SERVER_PORT = process.env.PORT || 3000;
server.listen(SERVER_PORT);
console.log(`Server listening on port ${SERVER_PORT}`);
