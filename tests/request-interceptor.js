const RequestMatcher = require("./request-matcher");

module.exports = class RequestInterceptor {
  constructor(page) {
    this.page = page;
    this.requests = [];
    this.matchers = [];

    page.on("request", (request) => {
      this.requests.push(request);
      this.matchers.forEach((matcher) => matcher.addRequest(request));
    });
  }

  createRequestMatcher(searchString) {
    const matcher = new RequestMatcher(searchString);

    this.requests.forEach((request) => matcher.addRequest(request));
    this.matchers.push(matcher);

    return matcher;
  }

  reset() {
    this.requests = [];
  }
};
