import type { LuxGlobal } from "../src/global";

export {};

declare global {
  declare const LUX: LuxGlobal;

  namespace PlaywrightTest {
    interface Matchers<R> {
      toBeBetween(a: number, b: number): R;
    }
  }
}
