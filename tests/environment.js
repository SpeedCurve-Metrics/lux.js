const PuppeteerEnvironment = require("jest-environment-puppeteer");
const RequestInterceptor = require("./request-interceptor");

class CustomEnvironment extends PuppeteerEnvironment {
  async setup() {
    await super.setup();

    this.global.requestInterceptor = new RequestInterceptor(this.global.page);
  }

  async teardown() {
    await super.teardown();
  }
}

module.exports = CustomEnvironment;
