import { JsonType } from "../types/generic.types";
import { onlyValues } from "../utils/data";
import { byWhitespace } from "../utils/strings";
import { fromJSON } from "./json";

export function toArray<TArrayValue extends JsonType = JsonType>(value?: unknown) {
  // `value` is a string
  if (value) {
    const maybeArray = typeof value === "string" ? fromJSON<Array<TArrayValue>>(value) : value;
    if (Array.isArray(maybeArray)) {
      return maybeArray as Array<TArrayValue>;
    } else if(typeof value === "string") {
      return value.split(byWhitespace).filter(onlyValues).map((splitValue) => fromJSON<TArrayValue>(splitValue));
    }
  }

  return undefined;
}
