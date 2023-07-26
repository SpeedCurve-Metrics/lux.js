import { Request } from "@playwright/test";

export default class RequestMatcher {
  searchString: string;
  requests: Request[] = [];

  constructor(searchString: string) {
    this.searchString = searchString;
  }

  addRequest(request: Request) {
    if (this.requestMatches(request.url())) {
      this.requests.push(request);
    }
  }

  requestMatches(url: string) {
    return url.search(this.searchString) > -1;
  }

  /**
   * Wait for a request to be matched. If afterCb is provided, this function will wait until a NEW
   * request is received after running the callback. If no callback is provided, this function will
   * wait until any number of requests has been received, i.e. if a request has already been received
   * this function will return immediately.
   */
  async waitForMatchingRequest(
    afterCb?: () => Promise<unknown>,
    requestCount?: number,
  ): Promise<void>;
  async waitForMatchingRequest(requestCount?: number): Promise<void>;
  async waitForMatchingRequest(...args): Promise<void> {
    let afterCb: (() => Promise<unknown>) | undefined;
    let requestCount: number | undefined;

    if (typeof args[0] === "function") {
      afterCb = args[0];
      requestCount = args[1] || this.requests.length + 1;
    } else if (typeof args[0] === "number") {
      requestCount = args[0];
    } else {
      requestCount = 1;
    }

    if (afterCb) {
      await afterCb();
    }

    return new Promise((resolve) => {
      if (this.requests.length >= requestCount!) {
        resolve();
      } else {
        const interval = setInterval(() => {
          if (this.requests.length >= requestCount!) {
            clearInterval(interval);
            resolve();
          }
        }, 20);
      }
    });
  }

  get(index: number): Request | undefined {
    return this.requests[index];
  }

  getUrl(index: number): URL | undefined {
    const request = this.get(index);

    if (!request) {
      return undefined;
    }

    return new URL(request.url());
  }

  count() {
    return this.requests.length;
  }

  reset() {
    this.requests = [];
  }
}
