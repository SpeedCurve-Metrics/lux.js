import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import url from "node:url";
import BeaconStore from "./helpers/beacon-store.js";

const __dirname = path.dirname(url.fileURLToPath(import.meta.url));
const testPagesDir = path.join(__dirname, "test-pages");
const distDir = path.join(__dirname, "..", "dist");

BeaconStore.open().then(async (store) => {
  await store.dropTable();
  await store.createTable();

  const server = createServer(async (req, res) => {
    const reqTime = new Date();
    const inlineSnippet = await readFile(path.join(distDir, "lux-snippet.js"));
    const parsedUrl = url.parse(req.url, true);
    const pathname = parsedUrl.pathname;

    const headers = (contentType) => {
      const h = {
        "cache-control": `public, max-age=${parsedUrl.query.maxAge || 0}`,
        "content-type": contentType,
        "server-timing": parsedUrl.query.serverTiming || "",
        "timing-allow-origin": "*",
      };

      if (!parsedUrl.query.keepAlive) {
        h.connection = "close";
      }

      return h;
    };

    const sendResponse = async (status, headers, body) => {
      console.log(
        [reqTime.toISOString(), status, req.method, `${pathname}${parsedUrl.search || ""}`].join(
          " ",
        ),
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

      case ".jpg":
        contentType = "image/jpeg";
        break;
    }

    if (parsedUrl.query.redirectTo) {
      // Send the redirect after a short delay so that the redirectStart time is measurable
      setTimeout(() => {
        sendResponse(302, { location: decodeURIComponent(parsedUrl.query.redirectTo) }, "");
      }, parsedUrl.query.redirectDelay || 0);
    } else if (pathname === "/") {
      sendResponse(200, headers("text/plain"), "OK");
    } else if (pathname === "/js/lux.min.js.map") {
      const contents = await readFile(path.join(distDir, "lux.min.js.map"));
      sendResponse(200, headers("application/json"), contents);
    } else if (pathname === "/js/lux.js") {
      const contents = await readFile(path.join(distDir, "lux.min.js"));
      let preamble = [
        "LUX=window.LUX||{}",
        `LUX.beaconUrl='http://localhost:${SERVER_PORT}/beacon/'`,
        `LUX.errorBeaconUrl='http://localhost:${SERVER_PORT}/error/'`,
        `LUX.beaconUrlV2='http://localhost:${SERVER_PORT}/v2/store/'`,
      ].join(";");

      sendResponse(200, headers(contentType), `${preamble};${contents}`);
    } else if (pathname === "/beacon/" || pathname === "/error/") {
      if (req.headers.referer) {
        const referrerUrl = url.parse(req.headers.referer, true);

        if ("useBeaconStore" in referrerUrl.query) {
          store.id = referrerUrl.query.useBeaconStore;
          store.put(
            reqTime.getTime(),
            req.headers["user-agent"],
            new URL(req.url, `http://${req.headers.host}`).href,
            parsedUrl.query.l,
            decodeURIComponent(parsedUrl.query.PN),
          );
        }
      }

      sendResponse(200, headers("image/webp"));
    } else if (pathname === "/v2/store/") {
      sendResponse(204, {}, "");
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

          if (parsedUrl.query.injectBeforeSnippet) {
            injectScript += parsedUrl.query.injectBeforeSnippet;
          }

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
            parseInt(parsedUrl.query.delay),
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
});
