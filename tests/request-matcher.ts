import { Request } from "puppeteer";

export default class RequestMatcher {
  searchString: string;
  requests: Request[] = [];

  constructor(searchString: string) {
    this.searchString = searchString;
  }

  addRequest(request: Request) {
    if (this.requestMatches(request)) {
      this.requests.push(request);
    }
  }

  requestMatches(request: Request) {
    return request.url().search(this.searchString) > -1;
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
