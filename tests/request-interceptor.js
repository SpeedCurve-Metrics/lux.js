module.exports = class RequestInterceptor {
  constructor(page) {
    this.page = page;
    this.requests = [];
    this.matchers = {};

    page.on("request", (req) => {
      this.requests.push(req);

      for (const search in this.matchers) {
        if (this.requestMatches(req, search)) {
          this.matchers[search].push(req);
        }
      }
    });
  }

  createRequestMatcher(search) {
    this.matchers[search] = this.requests.filter((req) => this.requestMatches(req, search));

    return this.matchers[search];
  }

  requestMatches(req, search) {
    return req.url().search(search) > -1;
  }

  findMatchingRequests(search) {
    return this.requests.filter((req) => this.requestMatches(req, search));
  }

  reset() {
    this.requests = [];
  }
};
