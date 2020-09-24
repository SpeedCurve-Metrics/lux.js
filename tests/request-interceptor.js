module.exports = class RequestInterceptor {
  constructor(page) {
    this.page = page;
    this.requests = [];

    page.on("request", (req) => this.requests.push(req));
  }

  findMatchingRequests(search) {
    return this.requests.filter((req) => req.url().search(search) > -1);
  }

  reset() {
    this.requests = [];
  }
};
