import { getNavigationEntry } from "./performance";

export function isVisible(): boolean {
  if (document.visibilityState) {
    return document.visibilityState === "visible";
  }

  // For browsers that don't support document.visibilityState, we assume the page is visible.
  return true;
}

export function onVisible(cb: () => void): void {
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
}

export function afterPrerender(cb: () => void): void {
  if (document.prerendering) {
    document.addEventListener("prerenderingchange", cb, true);
  }

  cb();
}

export function wasPrerendered(): boolean {
  return document.prerendering || getNavigationEntry().activationStart > 0;
}
