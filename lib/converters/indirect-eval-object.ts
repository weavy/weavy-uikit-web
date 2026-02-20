/**
 * Provides an eval function in the global scope.
 * @see https://rollupjs.org/troubleshooting/#eval2-eval
 */
const indirectEval = eval;

/**
 * Converts a javascript string to a predefined type T using indirect eval in strict mode.
 */
export function indirectEvalObject<T>(value?: string | T | null): T {
  if (typeof value === "string" && value) {
    value = indirectEval?.(`"use strict";(${value})`) as T;
  } else {
    value = undefined;
  }

  return value as T;
}
