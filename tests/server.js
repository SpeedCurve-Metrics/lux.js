const createServer = require("http").createServer;
const readFile = require("fs").readFile;
const path = require("path");
const url = require("url");

const SERVER_PORT = 3000;

const server = createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  const filePath = path.join(__dirname, "test-pages", pathname);
  let contentType = "text/html";

  if (pathname.substr(-3) === ".js") {
    contentType = "application/javascript";
  }

  if (pathname === "/js/lux.js") {
    readFile(path.join(__dirname, "..", "dist", "lux.min.js"), (err, contents) => {
      if (err) {
        res.writeHead(404);
        res.end("Not Found");
      } else {
        let preamble = `LUX=window.LUX||{};LUX.beaconUrl='http://localhost:${SERVER_PORT}/beacon/';`;

        if (parsedUrl.query.jspagelabel) {
          preamble += `LUX.jspagelabel=${JSON.stringify(parsedUrl.query.jspagelabel)};`;
        }

        res.writeHead(200, { "content-type": contentType });
        res.end(preamble + contents);
      }
    });
  } else if (pathname == "/beacon/") {
    res.writeHead(200, { "content-type": "application/javascript" });
    res.end(`/* Beacon received at ${new Date()} */`);
  } else {
    readFile(filePath, (err, contents) => {
      if (err) {
        res.writeHead(404);
        res.end("Not Found");
      } else {
        const sendResponse = () => {
          res.writeHead(200, { "content-type": contentType });
          res.end(contents);
        };

        if (parsedUrl.query.delay) {
          setTimeout(sendResponse, parseInt(parsedUrl.query.delay, 10));
        } else {
          sendResponse();
        }
      }
    });
  }
});

server.listen(SERVER_PORT);
