import { getNodeSelector } from "../dom";
import * as Events from "../events";
import { msSinceNavigationStart } from "../timing";

const CLICK_THRESHOLD = 5;
const CLICK_RADIUS = 50;
const COOLDOWN = 5000;

let timeout = 0;
let startTime = 0;
let clicks = 0;
let target: Node | null = null;
let x = 0;
let y = 0;

export type RageClickEvent = {
  canceledReason: string | null;
  clicks: number;
  rage: boolean;
  startTime: number;
  target: Node | null;
  x: number;
  y: number;
};

const listener = (event: MouseEvent) => {
  if (target === null) {
    startTime = msSinceNavigationStart();
    target = event.target as Node;
    x = event.clientX;
    y = event.clientY;
    timeout = window.setTimeout(() => {
      if (__DEBUG) {
        Events.emit("rage_click", {
          canceledReason: "timeout",
          clicks,
          rage: clicks >= CLICK_THRESHOLD,
          startTime,
          target,
          x,
          y,
        } satisfies RageClickEvent);
      }

      reset();
    }, COOLDOWN);
  }

  const nodeName = target.nodeName;
  const isSameTarget =
    event.target === target && (nodeName === "BUTTON" || nodeName === "A" || nodeName === "INPUT");
  const withinRadius =
    (Math.abs(x - event.clientX) < CLICK_RADIUS && Math.abs(y - event.clientY) < CLICK_RADIUS) ||
    isSameTarget;

  if (withinRadius) {
    clicks++;
  }

  if (__DEBUG) {
    Events.emit("rage_click", {
      canceledReason: null,
      clicks,
      rage: clicks >= CLICK_THRESHOLD,
      startTime,
      target,
      x,
      y,
    } satisfies RageClickEvent);
  }

  if (clicks >= CLICK_THRESHOLD) {
    // We've reached the rage click threshold, so cancel the reset timeout.
    clearTimeout(timeout);
  } else if (clicks && !withinRadius) {
    if (__DEBUG) {
      Events.emit("rage_click", {
        canceledReason: "out of radius",
        clicks,
        rage: clicks >= CLICK_THRESHOLD,
        startTime,
        target,
        x,
        y,
      } satisfies RageClickEvent);
    }

    // If we haven't reached the rage click threshold, and the clicks move outside the radius, then
    // reset the current rage status.
    reset();
  }
};

document.addEventListener("click", listener);

export function reset() {
  clearTimeout(timeout);
  clicks = 0;
  target = null;
  x = 0;
  y = 0;
}

export function getData() {
  if (clicks >= CLICK_THRESHOLD) {
    return {
      value: clicks,
      startTime,
      attribution: target
        ? {
            elementSelector: getNodeSelector(target),
            elementType: target.nodeName,
          }
        : null,
    };
  }

  return null;
}
