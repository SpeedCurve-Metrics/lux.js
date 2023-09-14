import { Page } from "@playwright/test";

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

export function getPageHiddenScript(hidden: boolean): string {
  return `
    Object.defineProperty(document, "visibilityState", {
      value: ${JSON.stringify(hidden ? "hidden" : "visible")},
      writable: true,
    });

    Object.defineProperty(document, "hidden", {
      value: ${JSON.stringify(hidden)},
      writable: true,
    });

    document.dispatchEvent(new Event("visibilitychange"));
  `;
}

export async function setPageHidden(page: Page, hidden: boolean) {
  await page.evaluate(getPageHiddenScript(hidden));
}
