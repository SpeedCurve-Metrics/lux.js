// Wrapper to support older browsers (<= IE8)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function addListener(type: string, callback: (event: any) => void, useCapture = false) {
  if (addEventListener) {
    addEventListener(type, callback, useCapture);
  } else if (window.attachEvent && __ENABLE_POLYFILLS) {
    window.attachEvent("on" + type, callback as EventListener);
  }
}

// Wrapper to support older browsers (<= IE8)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function removeListener(type: string, callback: (event: any) => void, useCapture = false) {
  if (removeEventListener) {
    removeEventListener(type, callback, useCapture);
  } else if (window.detachEvent && __ENABLE_POLYFILLS) {
    window.detachEvent("on" + type, callback);
  }
}
