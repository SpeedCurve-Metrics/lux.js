import { Page, Request, Response } from "playwright";
import RequestMatcher from "./request-matcher";

export default class RequestInterceptor {
  page: Page;
  requests: Request[] = [];
  responses: Response[] = [];
  matchers: RequestMatcher[] = [];

  constructor(page: Page) {
    this.page = page;

    page.on("request", (request) => {
      this.requests.push(request);
      this.matchers.forEach((matcher) => matcher.addRequest(request));
    });

    page.on("response", (response) => {
      this.responses.push(response);
      this.matchers.forEach((matcher) => matcher.addResponse(response));
    });
  }

  createRequestMatcher(searchString: string) {
    const matcher = new RequestMatcher(searchString);

    this.requests.forEach((request) => matcher.addRequest(request));
    this.responses.forEach((response) => matcher.addResponse(response));
    this.matchers.push(matcher);

    return matcher;
  }

  reset() {
    this.requests = [];
    this.responses = [];
  }
}
