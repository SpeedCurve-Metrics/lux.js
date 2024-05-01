import { addListener } from "../listeners";

export default function onPageLoad(callback: () => void) {
  if (document.readyState === "complete") {
    // If onload has already passed, send the beacon now.
    callback();
  } else {
    // Otherwise send the beacon slightly after onload.
    addListener("load", () => {
      setTimeout(callback, 200);
    });
  }
}
