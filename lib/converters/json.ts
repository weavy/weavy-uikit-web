import { JsonType } from "../types/generic.types";

export function fromJSON<T extends JsonType = JsonType>(value: string | null) {
  let parsed: JsonType = value
  if (value) {
    try {
      parsed = JSON.parse(value) as T;
    } catch {
      parsed = value
    }
  }
  return parsed;
}
