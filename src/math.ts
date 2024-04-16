export function floor(x: number): number {
  return Math.floor(x);
}

export const max = Math.max;

export const round = Math.round;

/**
 * Clamp a number so that it is never less than 0
 */
export function clamp(x: number): number {
  return max(0, x);
}

export function sortNumeric(a: number, b: number): number {
  return a - b;
}
