import * as PROPS from "./minification";
import { getNavigationEntry, timing } from "./performance";

export function isVisible(): boolean {
  if (document.visibilityState) {
    return document.visibilityState === "visible";
  }

  // For browsers that don't support document.visibilityState, we assume the page is visible.
  return true;
}

export function onVisible(cb: () => void): void {
  afterPrerender(() => {
    if (isVisible()) {
      cb();
    } else {
      const onVisibleCallback = () => {
        if (isVisible()) {
          cb();
          removeEventListener("visibilitychange", onVisibleCallback);
        }
      };

      addEventListener("visibilitychange", onVisibleCallback, true);
    }
  });
}

export function afterPrerender(cb: () => void): void {
  if (document.prerendering) {
    document.addEventListener("prerenderingchange", cb, true);
  } else {
    cb();
  }
}

export function wasPrerendered(): boolean {
  return document.prerendering || getNavigationEntry()[PROPS.activationStart] > 0;
}

export function wasRedirected(): boolean {
  return getNavigationEntry().redirectCount! > 0 || timing.redirectEnd > 0;
}
