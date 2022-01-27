import PuppeteerEnvironment from "jest-environment-puppeteer";
import RequestInterceptor from "./request-interceptor";
declare global {
  const requestInterceptor: RequestInterceptor;
  const navigateTo: typeof page.goto;
}

class CustomEnvironment extends PuppeteerEnvironment {
  async setup() {
    await super.setup();

    const browserVersion = await this.global.browser.version();

    console.log(`Running tests in ${browserVersion}`);

    this.global.requestInterceptor = new RequestInterceptor(this.global.page);
    this.global.navigateTo = (url) => this.global.page.goto(url, { waitUntil: "networkidle0" });
    this.global.reportErrors = true;

    this.global.page.setCacheEnabled(false);

    this.global.page.on("pageerror", (error) => {
      if (this.global.reportErrors) {
        console.error("[PAGE ERROR]", error);
      }
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
  }

  async teardown() {
    await super.teardown();
  }
}

module.exports = CustomEnvironment;
