const createServer = require("http").createServer;
const readFile = require("fs").readFile;
const path = require("path");
const url = require("url");

const server = createServer((req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  let filePath = path.join(__dirname, "test-pages", pathname);
  let contentType = "text/html";

  if (pathname.substr(-3) === ".js") {
    contentType = "application/javascript";
  }

  if (pathname === "/js/lux.js") {
    filePath = path.join(__dirname, "..", "dist", "lux.min.js");
  }

  readFile(filePath, (err, contents) => {
    if (err) {
      res.writeHead(404);
      res.end("Not Found");
    } else {
      if (parsedUrl.query.jspagelabel) {
        contents = `LUX=LUX||{};LUX.jspagelabel=${JSON.stringify(
          parsedUrl.query.jspagelabel
        )};${contents}`;
      }

      res.writeHead(200, { "content-type": contentType });
      res.end(contents);
    }
  });
});

server.listen(3000);
