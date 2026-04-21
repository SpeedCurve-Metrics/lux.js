import type { ConfigObject } from "./config";
import { postJson } from "./transport";

type ErrorBeaconContext = {
  customerId: string;
  pageId: string;
  sessionId: string;
  scriptVersion: string;
  hostname: string;
  pathname: string;
  pageLabel: string;
  connectionType: string | undefined;
  deliveryType: string | undefined;
  navigationType: number | undefined;
  deviceMemory: number | undefined;
  flags: number;
  customData: Record<string, unknown>;
};

type BufferedError = {
  errorTime: number;
  filename: string;
  lineno: number;
  colno: number;
  message: string;
};

let buffer: BufferedError[] = [];
let pendingContext: ErrorBeaconContext | null = null;
let pendingConfig: ConfigObject | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

export function queueErrorBeacon(
  config: ConfigObject,
  error: ErrorEvent,
  errorTime: number,
  context: ErrorBeaconContext,
): void {
  // If the page context changed (e.g. SPA navigation), flush the current buffer first
  if (pendingContext && pendingContext.pageId !== context.pageId) {
    flushErrorBeacon();
  }

  pendingContext = context;
  pendingConfig = config;
  buffer.push({
    errorTime,
    filename: error.filename,
    lineno: error.lineno,
    colno: error.colno,
    message: error.message,
  });

  if (flushTimer === null) {
    flushTimer = setTimeout(flushErrorBeacon, config.errorBeaconDelay);
  }
}

function flushErrorBeacon(): void {
  if (flushTimer !== null) {
    clearTimeout(flushTimer);
    flushTimer = null;
  }

  if (buffer.length === 0 || !pendingContext || !pendingConfig) {
    return;
  }

  postJson(
    pendingConfig.errorBeaconUrl,
    JSON.stringify(Object.assign({}, pendingContext, { errors: buffer })),
  );

  buffer = [];
  pendingContext = null;
  pendingConfig = null;
}
