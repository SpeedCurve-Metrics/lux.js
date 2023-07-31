import { T_UNDEFINED } from "./utils";

export type CustomDataDict = Record<string, unknown>;

const customDataValues: CustomDataDict = {};
let updatedCustomData: CustomDataDict = {};

export function addCustomDataValue(name: string, value: unknown): void {
  const typeV = typeof value;

  if (customDataValues[name] !== value) {
    // If the value is new or different to the previous value, record it so that later we can send
    // only the values that have changed.
    updatedCustomData[name] = value;
  }

  if (typeV === "string" || typeV === "number" || typeV === "boolean") {
    customDataValues[name] = value;
  }

  if (typeV === T_UNDEFINED || value === null) {
    delete customDataValues[name];
  }
}

export function getAllCustomData(): CustomDataDict {
  return customDataValues;
}

export function getUpdatedCustomData(): CustomDataDict {
  return updatedCustomData;
}

export function clearUpdateCustomData(): void {
  updatedCustomData = {};
}

/**
 * Convert a set of custom data values to the string format expected by the backend.
 */
export function valuesToString(values: CustomDataDict): string {
  const strings = [];

  for (let key in values) {
    // Convert all values to strings
    let value = "" + values[key];

    // Strip out reserved characters (, and | are used as delimiters)
    key = key.replace(/,/g, "").replace(/\|/g, "");
    value = value.replace(/,/g, "").replace(/\|/g, "");

    strings.push(key + "|" + value);
  }

  return encodeURIComponent(strings.join(","));
}
