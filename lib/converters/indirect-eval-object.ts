/**
 * Converts a javascript string to a predefined type T using indirect eval in strict mode.
 */
export function indirectEvalObject<T>(value?: string | T): T {
  if (typeof value === "string") {
    value = eval?.(`"use strict";(${value})`);
  }

  return value as T;
}
