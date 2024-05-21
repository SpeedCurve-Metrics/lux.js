import { Command, LuxGlobal } from "./global";
import { msSinceNavigationStart, performance } from "./performance";
import scriptStartTime from "./start-marker";

/**
 * This is the inline snippet that we ask customers to put at the top of their pages. It provides
 * polyfills for performance.mark/measure, registers a PerformanceObserver and error handler, and
 * allows LUX functions to be called before the full script is loaded.
 */
// eslint-disable-next-line no-var
declare var LUX: LuxGlobal;

LUX = window.LUX || ({} as LuxGlobal);
LUX.ac = [];
LUX.addData = (name, value) => LUX.cmd(["addData", name, value]);
LUX.cmd = (cmd: Command) => LUX.ac!.push(cmd);
LUX.getDebug = () => [[scriptStartTime, 0, []]];
LUX.init = () => LUX.cmd(["init"]);
LUX.mark = _mark;
LUX.markLoadTime = () => LUX.cmd(["markLoadTime", msSinceNavigationStart()]);
LUX.measure = _measure;
LUX.send = () => LUX.cmd(["send"]);
LUX.ns = scriptStartTime;

export default LUX;

function _mark(...args: Parameters<LuxGlobal["mark"]>): ReturnType<LuxGlobal["mark"]> {
  if (performance.mark) {
    // Use the native performance.mark where possible...
    return performance.mark(...args);
  }

  // Rather than providing a full polyfill in the snippet, we record the current time and use
  // LUX.cmd() to allow the full lux.js script to provide the polyfill.
  const name = args[0];
  const options = args[1] || {};

  if (typeof options.startTime === "undefined") {
    options.startTime = msSinceNavigationStart();
  }

  LUX.cmd(["mark", name, options]);
}

function _measure(...args: Parameters<LuxGlobal["measure"]>): ReturnType<LuxGlobal["measure"]> {
  if (performance.measure) {
    // Use the native performance.measure where possible...
    return performance.measure(...args);
  }

  // Like the mark function above, we use LUX.cmd() to defer to the full lux.js rather than providing
  // a polyfill in the snippet.
  const name = args[0];
  const startMarkName = args[1] as string | number;
  const endMarkName = args[2] as string | number;
  let options;

  if (typeof startMarkName === "object") {
    options = args[1] as PerformanceMeasureOptions;
  } else {
    options = {
      start: startMarkName,
      end: endMarkName,
    };
  }

  if (!options.duration && !options.end) {
    // If no duration or end mark was specified, use the current time as the end
    options.end = msSinceNavigationStart();
  }

  LUX.cmd(["measure", name, options]);
}

// error handler
window.LUX_ae = []; // array of error events
window.addEventListener("error", function (e) {
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
  window.LUX_ae!.push(e);
});
