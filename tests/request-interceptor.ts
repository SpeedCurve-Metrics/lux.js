import { Page, Request } from "playwright";
import RequestMatcher from "./request-matcher";

export default class RequestInterceptor {
  page: Page;
  requests: Request[] = [];
  matchers: RequestMatcher[] = [];

  constructor(page: Page) {
    this.page = page;

    page.on("request", (request) => {
      this.requests.push(request);
      this.matchers.forEach((matcher) => matcher.addRequest(request));
    });
  }

  createRequestMatcher(searchString: string) {
    const matcher = new RequestMatcher(searchString);

    this.requests.forEach((request) => matcher.addRequest(request));
    this.matchers.push(matcher);

    return matcher;
  }

  reset() {
    this.requests = [];
  }
}
