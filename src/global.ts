import { UserConfig } from "./config";

export type Command = [CommandFunction, ...CommandArg[]];
type CommandFunction = "addData" | "init" | "mark" | "markLoadTime" | "measure" | "send";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommandArg = any;

export interface LuxGlobal extends UserConfig {
  ac?: Command[];
  addData?: (name: string, value: unknown) => void;
  ae?: unknown[];
  al?: unknown[];
  cmd?: (cmd: Command) => void;
  doUpdate?: () => void;
  forceSample?: () => void;
  gaMarks?: PerformanceEntryList;
  gaMeasures?: PerformanceEntryList;
  getDebug?: () => void;
  getSessionId?: () => void;
  init?: () => void;
  mark?: typeof performance.mark;
  markLoadTime?: (time?: number) => void;
  measure?: typeof performance.measure;
  ns?: number;
  send?: () => void;
  version?: string;
}
