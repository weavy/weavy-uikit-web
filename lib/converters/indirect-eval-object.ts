/**
 * Converts a javascript string to a predefined type T using indirect eval in strict mode.
 */
export function indirectEvalObject<T>(value?: string | T | null | undefined): T {
  if (typeof value === "string" && value) {
    value = eval?.(`"use strict";(${value})`);
  } else {
    value = undefined;
  }

  return value as T;
}
