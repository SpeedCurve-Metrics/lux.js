import PuppeteerEnvironment from "jest-environment-puppeteer";
import { HTTPResponse, PuppeteerLifeCycleEvent } from "puppeteer";
import RequestInterceptor from "./request-interceptor";
import { LuxGlobal } from "../src/global";
declare global {
  const LUX: LuxGlobal;
  const requestInterceptor: RequestInterceptor;
  const navigateTo: (url: string, waitUntil?: PuppeteerLifeCycleEvent) => Promise<HTTPResponse>;
}

class CustomEnvironment extends PuppeteerEnvironment {
  async setup() {
    await super.setup();

    this.global.reportErrors = true;
    this.global.requestInterceptor = new RequestInterceptor(this.global.page);
    this.global.waitForNetworkIdle = (idleTime = 120) => {
      return this.global.page.waitForNetworkIdle({ idleTime });
    };

    this.global.navigateTo = (url: string, waitUntil: PuppeteerLifeCycleEvent = "networkidle0") => {
      return this.global.page.goto(`http://localhost:3000${url}`, { waitUntil });
    };

    this.global.page.setCacheEnabled(false);

    this.global.page.on("pageerror", (error) => {
      if (this.global.reportErrors) {
        console.error("[PAGE ERROR]", error);
      }
    });

    this.global.page.on("console", (msg) => {
      const type = msg.type();
      const isTimer = ["time", "timeEnd"].includes(type);

      Promise.all(msg.args().map((arg) => arg.jsonValue())).then((args) => {
        if (args.length) {
          if (typeof console[type] === "function" && !isTimer) {
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
