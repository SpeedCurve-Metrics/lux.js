import { UserConfig } from "./config";

export type Command = [CommandFunction, ...CommandArg[]];
type CommandFunction = "addData" | "init" | "mark" | "measure" | "send";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommandArg = any;

export interface LuxGlobal extends UserConfig {
  ac?: Command[];
  addData?: (name: string, value: unknown) => void;
  cmd?: (cmd: Command) => void;
  gaMarks?: PerformanceEntryList;
  gaMeasures?: PerformanceEntryList;
  init?: () => void;
  mark?: typeof performance.mark;
  measure?: typeof performance.measure;
  ns?: number;
  send?: () => void;
}
