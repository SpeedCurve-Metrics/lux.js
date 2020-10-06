const PuppeteerEnvironment = require("jest-environment-puppeteer");
const RequestInterceptor = require("./request-interceptor");

class CustomEnvironment extends PuppeteerEnvironment {
  async setup() {
    await super.setup();

    this.global.page.setCacheEnabled(false);
    this.global.requestInterceptor = new RequestInterceptor(this.global.page);
    this.global.navigateTo = (url) => this.global.page.goto(url, { waitUntil: "networkidle0" });
  }

  async teardown() {
    await super.teardown();
  }
}

module.exports = CustomEnvironment;
