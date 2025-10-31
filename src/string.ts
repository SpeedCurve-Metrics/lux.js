import * as PROPS from "./minification";

export function padStart(str: string, length: number, char: string): string {
  while (str[PROPS._length] < length) {
    str = char + str;
  }

  return str;
}
