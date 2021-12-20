import PuppeteerEnvironment from "jest-environment-puppeteer";
import RequestInterceptor from "./request-interceptor";

class CustomEnvironment extends PuppeteerEnvironment {
  async setup() {
    await super.setup();

    const browserVersion = await this.global.browser.version();

    console.log(`Running tests in ${browserVersion}`);

    this.global.page.setCacheEnabled(false);

    this.global.page.on("pageerror", (error) => {
      console.error("[PAGE ERROR]", error);
    });

    this.global.page.on("console", (msg) => {
      const type = msg.type();

      Promise.all(msg.args().map((arg) => arg.jsonValue())).then((args) => {
        if (args.length) {
          if (typeof console[type] === "function") {
            console[type](...["[PAGE CONSOLE]"].concat(args));
          } else {
            console.log(...["[PAGE CONSOLE]"].concat(args));
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