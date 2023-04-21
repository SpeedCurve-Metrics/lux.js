import { Request, Response } from "playwright";

export default class RequestMatcher {
  searchString: string;
  requests: Request[] = [];
  responses: Response[] = [];

  constructor(searchString: string) {
    this.searchString = searchString;
  }

  addRequest(request: Request) {
    if (this.requestMatches(request.url())) {
      this.requests.push(request);
    }
  }

  addResponse(response: Response) {
    if (this.requestMatches(response.url())) {
      this.responses.push(response);
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
  async waitForMatchingRequest(afterCb?: () => Promise<unknown>): Promise<void> {
    return this.waitForChange(this.requests, afterCb);
  }

  async waitForMatchingResponse(afterCb?: () => Promise<unknown>): Promise<void> {
    return this.waitForChange(this.responses, afterCb);
  }

  async waitForChange(watch: Array<unknown>, afterCb?: () => Promise<unknown>): Promise<void> {
    const requestThreshold = afterCb ? watch.length + 1 : 1;

    if (afterCb) {
      await afterCb();
    }

    return new Promise((resolve) => {
      if (watch.length >= requestThreshold) {
        resolve();
      } else {
        const interval = setInterval(() => {
          if (watch.length >= requestThreshold) {
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
