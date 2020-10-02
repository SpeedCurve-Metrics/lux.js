const createServer = require("http").createServer;
const readFile = require("fs").readFile;
const path = require("path");
const url = require("url");

const server = createServer((req, res) => {
  const pathname = url.parse(req.url).pathname;

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
      res.writeHead(200, { "content-type": contentType });
      res.end(contents);
    }
  });
});

server.listen(3000);
