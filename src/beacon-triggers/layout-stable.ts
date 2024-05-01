import * as PO from "../performance-observer";
import onPageLoad from "./page-load";

export function onLayoutStable(stableTime: number, callback: () => void) {
  onPageLoad(() => {
    let timeoutId = setTimeout(callback, stableTime);

    const observer = PO.observe("layout-shift", () => {
      clearTimeout(timeoutId);

      timeoutId = setTimeout(() => {
        observer!.disconnect();
        callback();
      }, stableTime);
    });
  });
}
