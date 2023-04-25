import { UserConfig } from "./config";
import { LogEventRecord } from "./logger";

export type Command = [CommandFunction, ...CommandArg[]];
type CommandFunction = "addData" | "init" | "mark" | "markLoadTime" | "measure" | "send";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommandArg = any;
type PerfMarkFn = typeof performance.mark;
type PerfMeasureFn = typeof performance.measure;

export interface LuxGlobal extends UserConfig {
  /** Command queue used to store actions that were initiated before the full script loads */
  ac?: Command[];
  addData: (name: string, value: unknown) => void;
  cmd: (cmd: Command) => void;
  /** @deprecated */
  doUpdate?: () => void;
  forceSample?: () => void;
  getDebug?: () => LogEventRecord[];
  getSessionId?: () => void;
  init: () => void;
  mark: (...args: Parameters<PerfMarkFn>) => ReturnType<PerfMarkFn> | void;
  markLoadTime?: (time?: number) => void;
  measure: (...args: Parameters<PerfMeasureFn>) => ReturnType<PerfMeasureFn> | void;
  /** Timestamp representing when the LUX snippet was evaluated */
  ns?: number;
  send: () => void;
  version?: string;
}
