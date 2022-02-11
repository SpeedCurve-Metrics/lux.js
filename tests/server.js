const { createServer } = require("http");
const { readFile } = require("fs/promises");
const { readFileSync } = require("fs");
const path = require("path");
const url = require("url");

const SERVER_PORT = 3000;

const testPagesDir = path.join(__dirname, "test-pages");
const inlineSnippet = readFileSync(path.join(testPagesDir, "lux-inline-snippet.js"));

const server = createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

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
    const contents = await readFile(path.join(__dirname, "..", "dist", "lux.min.js"));
    let preamble = `LUX=window.LUX||{};LUX.beaconUrl='http://localhost:${SERVER_PORT}/beacon/';LUX.errorBeaconUrl='http://localhost:${SERVER_PORT}/error/';`;

    res.writeHead(200, { "content-type": contentType });
    res.end(preamble + contents);
  } else if (pathname == "/beacon/" || pathname == "/error/") {
    res.writeHead(200, { "content-type": "image/webp" });
    res.end();
  } else {
    try {
      let contents = await readFile(filePath);

      if (contentType === "text/html") {
        let injectScript = "";

        if (!parsedUrl.query.noInlineSnippet) {
          injectScript += inlineSnippet;
        }

        if (parsedUrl.query.injectScript) {
          injectScript += parsedUrl.query.injectScript;
        }

        contents = contents.toString().replace("/*INJECT_SCRIPT*/", injectScript);
      }

      const sendResponse = () => {
        res.writeHead(200, { "content-type": contentType });
        res.end(contents);
      };

      if (parsedUrl.query.delay) {
        setTimeout(sendResponse, parseInt(parsedUrl.query.delay, 10));
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

server.listen(SERVER_PORT);
