import { UserConfig } from "./config";

export type Command = [CommandFunction, ...CommandArg[]];
type CommandFunction = "addData" | "init" | "mark" | "measure" | "send";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CommandArg = any;

export interface PerformanceEntryShim {
  name: string;
  entryType: "mark" | "measure";
  startTime: number;
  duration: number;
}

export interface LuxGlobal extends UserConfig {
  ac?: Command[];
  addData?: (name: string, value: unknown) => void;
  cmd?: (cmd: Command) => void;
  gaMarks?: PerformanceEntryShim[];
  gaMeasures?: PerformanceEntryShim[];
  init?: () => void;
  mark?: typeof performance.mark;
  measure?: typeof performance.measure;
  ns?: number;
  send?: () => void;
}
