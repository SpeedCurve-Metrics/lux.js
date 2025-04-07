export {};

declare global {
  namespace PlaywrightTest {
    interface Matchers<R> {
      toBeBetween(a: number, b: number): R;
    }
  }
}
