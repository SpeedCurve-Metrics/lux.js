const PuppeteerEnvironment = require("jest-environment-puppeteer");
const RequestInterceptor = require("./request-interceptor");

class CustomEnvironment extends PuppeteerEnvironment {
  async setup() {
    await super.setup();

    this.global.page.setCacheEnabled(false);
    this.global.page.on("console", (msg) => {
      const type = msg.type();

      Promise.all(msg.args().map((arg) => arg.jsonValue())).then((args) => {
        if (args.length) {
          if (typeof console[type] === "function") {
            console[type].apply(console, ["[PAGE CONSOLE]"].concat(args));
          } else {
            console.log.apply(console, ["[PAGE CONSOLE]"].concat(args));
          }
        }
      });
    });

    this.global.requestInterceptor = new RequestInterceptor(this.global.page);
    this.global.navigateTo = (url) => this.global.page.goto(url, { waitUntil: "networkidle0" });
  }

  async teardown() {
    await super.teardown();
  }
}

module.exports = CustomEnvironment;
