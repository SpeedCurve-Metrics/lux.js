export function padStart(str: string, length: number, char: string): string {
  while (str.length < length) {
    str = char + str;
  }

  return str;
}
