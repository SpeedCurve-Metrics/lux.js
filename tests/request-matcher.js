module.exports = class RequestMatcher {
  constructor(searchString) {
    this.searchString = searchString;
    this.requests = [];
  }

  addRequest(request) {
    if (this.requestMatches(request)) {
      this.requests.push(request);
    }
  }

  requestMatches(request) {
    return request.url().search(this.searchString) > -1;
  }

  get(index) {
    return this.requests[index];
  }

  getUrl(index) {
    return new URL(this.requests[index].url());
  }

  count() {
    return this.requests.length;
  }

  reset() {
    this.requests = [];
  }
};
