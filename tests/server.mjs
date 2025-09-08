import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import BeaconStore from "./helpers/beacon-store.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const testPagesDir = path.join(__dirname, "test-pages");
const distDir = path.join(__dirname, "..", "dist");

BeaconStore.open().then(async (store) => {
  await store.dropTable();
  await store.createTable();

  const server = createServer(async (req, res) => {
    const reqTime = new Date();
    const inlineSnippet = await readFile(path.join(distDir, "lux-snippet.es2020.js"));
    const url = new URL(req.url, `http://${req.headers.host}`);
    const pathname = url.pathname;

    const headers = (contentType) => {
      const h = {
        "cache-control": `public, max-age=${url.searchParams.get("maxAge") || 0}`,
        "content-type": contentType,
        "server-timing": url.searchParams.get("serverTiming") || "",
        "timing-allow-origin": "*",
      };

      if (!url.searchParams.get("keepAlive")) {
        h.connection = "close";
      }

      if (url.searchParams.has("csp")) {
        const cspHeader = url.searchParams.get("cspReportOnly")
          ? "content-security-policy-report-only"
          : "content-security-policy";
        h[cspHeader] = url.searchParams.get("csp");
      }

      return h;
    };

    const sendResponse = async (status, headers, body) => {
      console.log(
        [reqTime.toISOString(), status, req.method, `${pathname}${url.search || ""}`].join(" "),
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

    if (url.searchParams.has("redirectTo")) {
      // Send the redirect after a short delay so that the redirectStart time is measurable
      const redirectLocation = decodeURIComponent(url.searchParams.get("redirectTo"));

      setTimeout(
        () => {
          sendResponse(302, { location: redirectLocation }, "");
        },
        url.searchParams.get("redirectDelay") || 0,
      );
    } else if (pathname === "/") {
      sendResponse(200, headers("text/plain"), "OK");
    } else if (pathname === "/js/lux.min.js.map") {
      const contents = await readFile(path.join(distDir, "lux.min.js.map"));
      sendResponse(200, headers("application/json"), contents);
    } else if (pathname === "/js/snippet.js") {
      const contents = await readFile(path.join(distDir, "lux-snippet.es2020.js"));
      sendResponse(200, headers("application/json"), contents);
    } else if (pathname === "/js/lux.js") {
      const contents = await readFile(path.join(distDir, "lux.min.js"));
      let preamble = [
        "LUX=window.LUX||{}",
        "LUX.allowEmptyPostBeacon=true;",
        `LUX.beaconUrl='http://localhost:${SERVER_PORT}/beacon/'`,
        `LUX.beaconUrlFallback='http://localhost:${SERVER_PORT}/csp-approved/store/'`,
        `LUX.beaconUrlV2='http://localhost:${SERVER_PORT}/v2/store/'`,
        `LUX.errorBeaconUrl='http://localhost:${SERVER_PORT}/error/'`,
      ].join(";");

      sendResponse(200, headers(contentType), `${preamble};${contents}`);
    } else if (pathname === "/beacon/" || pathname === "/error/") {
      if (req.headers.referer) {
        const referrerUrl = new URL(req.headers.referer);

        if (referrerUrl.searchParams.has("useBeaconStore")) {
          store.id = referrerUrl.searchParams.get("useBeaconStore");
          store.put(
            reqTime.getTime(),
            req.headers["user-agent"],
            new URL(req.url, `http://${req.headers.host}`).href,
            url.searchParams.get("l"),
            decodeURIComponent(url.searchParams.get("PN")),
          );
        }
      }

      sendResponse(200, headers("image/webp"));
    } else if (pathname === "/v2/store/" || pathname === "/csp-approved/store/") {
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

          if (url.searchParams.has("injectBeforeSnippet")) {
            injectScript += url.searchParams.get("injectBeforeSnippet");
          }

          if (!url.searchParams.has("noInlineSnippet")) {
            injectScript += inlineSnippet;
          }

          if (url.searchParams.has("injectScript")) {
            injectScript += url.searchParams.get("injectScript");
          }

          contents = contents.toString().replace("/*INJECT_SCRIPT*/", injectScript);
        }

        if (url.searchParams.has("delay")) {
          setTimeout(
            () => sendResponse(200, headers(contentType), contents),
            parseInt(url.searchParams.get("delay")),
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
