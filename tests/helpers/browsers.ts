import { Page } from "@playwright/test";

export function referenceErrorMessage(browserName: string, reference: string) {
  switch (browserName) {
    case "webkit":
      return `ReferenceError: Can't find variable: ${reference}`;

    default:
      return `ReferenceError: ${reference} is not defined`;
  }
}

export function syntaxErrorMessage(browserName: string) {
  switch (browserName) {
    case "firefox":
      return "SyntaxError: expected expression, got end of script";

    case "webkit":
      return "SyntaxError: Unexpected end of script";

    default:
      return "SyntaxError: Unexpected end of input";
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

export async function entryTypeSupported(page: Page, entryType: string): Promise<boolean> {
  return page.evaluate(
    (entryType) => PerformanceObserver.supportedEntryTypes.includes(entryType),
    entryType,
  );
}
