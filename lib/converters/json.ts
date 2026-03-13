import { JsonType } from "../types/generic.types";

export function fromJSON<T extends JsonType = JsonType>(value: string | null) {
  let parsed: T = value as T
  if (value) {
    try {
      parsed = JSON.parse(value) as T;
    } catch {
      parsed = value as T
    }
  }
  return parsed;
}
