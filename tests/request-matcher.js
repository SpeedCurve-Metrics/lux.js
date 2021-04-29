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
    if (typeof this.requests[index] === "undefined") {
      throw new Error(`Request at index ${index} does not exist`);
    }

    return this.requests[index];
  }

  getUrl(index) {
    return new URL(this.get(index).url());
  }

  count() {
    return this.requests.length;
  }

  reset() {
    this.requests = [];
  }
};
