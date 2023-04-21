export function referenceErrorMessage(browserName, reference) {
  switch (browserName) {
    case "chromium":
      return `ReferenceError: ${reference} is not defined`;

    case "firefox":
      return `ReferenceError: ${reference} is not defined`;

    case "webkit":
      return `ReferenceError: Can't find variable: ${reference}`;
  }
}

export function syntaxErrorMessage(browserName) {
  switch (browserName) {
    case "chromium":
      return "SyntaxError: Unexpected end of input";

    case "firefox":
      return "SyntaxError: expected expression, got end of script";

    case "webkit":
      return "SyntaxError: Unexpected end of script";
  }
}
