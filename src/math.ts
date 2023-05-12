/**
 * Round a number down to the nearest integet
 */
export function floor(x: number): number {
  return Math.floor(x);
}

/**
 * Clamp a number so that it is never less than 0
 */
export function clamp(x: number): number {
  return Math.max(0, x);
}
