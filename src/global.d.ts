import type { UserConfig } from "./config";
import type { Event } from "./events";
import type { LogEventRecord } from "./logger";

export type Command = [CommandFunction, ...CommandArg[]];
type CommandFunction =
  | "addData"
  | "init"
  | "mark"
  | "markLoadTime"
  | "measure"
  | "on"
  | "send"
  | "startSoftNavigation";

type CommandArg = unknown;
type PerfMarkFn = typeof performance.mark;
type PerfMeasureFn = typeof performance.measure;

/**
 * LuxGlobal is the global `LUX` object. It is defined and modified by the snippet, lux.js and by
 * the implementor.
 */
export interface LuxGlobal extends UserConfig {
  /** Command queue used to store actions that were initiated before the full script loads */
  ac?: Command[];
  addData: (name: string, value?: unknown) => void;
  cmd: (cmd: Command) => void;
  /** @deprecated */
  doUpdate?: () => void;
  forceSample?: () => void;
  getDebug: () => LogEventRecord[];
  getSessionId?: () => void;
  init: (time?: number) => void;
  mark: (...args: Parameters<PerfMarkFn>) => ReturnType<PerfMarkFn> | void;
  markLoadTime: (time?: number) => void;
  measure: (...args: Parameters<PerfMeasureFn>) => ReturnType<PerfMeasureFn> | void;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  on: (event: Event, callback: (data?: any) => void) => void;
  /** Timestamp representing when the LUX snippet was evaluated */
  ns?: number;
  send: (force?: boolean) => void;
  snippetVersion?: string;
  startSoftNavigation: (time?: number) => void;
  version?: string;
}
