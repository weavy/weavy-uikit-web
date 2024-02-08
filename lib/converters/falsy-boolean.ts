/**
 * Parses a falsy string value or falsy value to Boolean
 */
export function falsyBoolean(value?: unknown): boolean {
  const isEmptyString = typeof value === "string" && value.length <= 0;
  const isUndefined = value === undefined || typeof value === "undefined" || value === "undefined";
  const isFalsy = isUndefined || isEmptyString;
  return !isFalsy && (typeof value === "string" ? !!JSON.parse(value) : !!value);
}
