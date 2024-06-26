import { addListener } from "../listeners";

export default function onPageLoad(callback: () => void) {
  if (document.readyState === "complete") {
    // The onload event has already fired
    callback();
  } else {
    // Listen for the onload event and run the callback after a short delay
    addListener("load", () => {
      setTimeout(callback, 200);
    });
  }
}
