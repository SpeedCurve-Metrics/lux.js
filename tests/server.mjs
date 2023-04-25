import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import url from "node:url";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const testPagesDir = path.join(__dirname, "test-pages");
const distDir = path.join(__dirname, "..", "dist");

const headers = (contentType) => ({
  "content-type": contentType,
  connection: "close",
});

const server = createServer(async (req, res) => {
  const reqTime = new Date();
  const inlineSnippet = await readFile(path.join(distDir, "lux-snippet.js"));
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  const sendResponse = (status, headers, body) => {
    console.log(
      [reqTime.toISOString(), status, req.method, `${pathname}${parsedUrl.search || ""}`].join(" ")
    );

    res.writeHead(status, headers);
    res.end(body);
  };

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

  if (pathname === "/") {
    sendResponse(200, headers("text/plain"), "OK");
  } else if (pathname === "/js/lux.js") {
    const contents = await readFile(path.join(distDir, "lux.min.js"));
    let preamble = `LUX=window.LUX||{};LUX.beaconUrl='http://localhost:${SERVER_PORT}/beacon/';LUX.errorBeaconUrl='http://localhost:${SERVER_PORT}/error/';`;

    sendResponse(200, headers(contentType), preamble + contents);
  } else if (pathname == "/beacon/" || pathname == "/error/") {
    sendResponse(200, headers("image/webp"));
  } else if (existsSync(filePath)) {
    try {
      let contents = await readFile(filePath);

      if (contentType === "text/html") {
        let injectScript = `
          window.createLongTask = (duration = 50) => {
              const startTime = performance.now();

              while (performance.now() < startTime + duration) {
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

      if (parsedUrl.query.delay) {
        setTimeout(
          () => sendResponse(200, headers(contentType), contents),
          parseInt(parsedUrl.query.delay)
        );
      } else {
        sendResponse(200, headers(contentType), contents);
      }
    } catch (e) {
      console.error(e);
      sendResponse(404, headers("text/plain"), "Not Found");
    }
  } else {
    sendResponse(404, headers("text/plain"), "Not Found");
  }
});

const SERVER_PORT = process.env.PORT || 3000;
server.listen(SERVER_PORT);
console.log(`Server listening on port ${SERVER_PORT}`);