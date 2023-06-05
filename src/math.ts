export function floor(x: number): number {
  return Math.floor(x);
}

export const max = Math.max;

/**
 * Clamp a number so that it is never less than 0
 */
export function clamp(x: number): number {
  return max(0, x);
}
