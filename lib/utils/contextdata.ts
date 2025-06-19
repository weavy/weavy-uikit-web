import { v4 as uuid_v4 } from "uuid";
import { DataRefType } from "../types/refs.types";
import { hasToJSON, isJSONSerializable } from "./objects";
import { getCircularReferenceReplacer } from "./data";

/**
 * Returns an URL if the object is an URL or a string that is an URL.
 *
 * @param item - string or URL.
 * @returns
 */
export function asURL(item: unknown) {
  if (item instanceof URL) {
    return item;
  } else {
    try {
      if (!item || typeof item !== "string") {
        throw new Error("Unparsable string");
      }
      return new URL(item);
    } catch {
      return undefined;
    }
  }
}

export function getContextDataRef(item: unknown) {
  let dataRef: DataRefType | undefined;

  if (item instanceof URL) {
    dataRef = { type: "url", item };
  } else if (item instanceof File) {
    dataRef = { type: "file", item };
  } else if (item instanceof Blob) {
    dataRef = {
      type: "file",
      item: new File([item], `${uuid_v4()}`, { type: item.type }),
    };
  } else if (typeof item === "string") {
    dataRef = {
      type: "file",
      item: new File([item], `${uuid_v4()}.data.txt`, { type: "text/plain;charset=UTF-8" }),
    };
  } else if (isJSONSerializable(item) || hasToJSON(item)) {
    try {
      const jsonItem = hasToJSON(item) ? item.toJSON() : JSON.stringify(item, getCircularReferenceReplacer(), 2);
      dataRef = {
        type: "file",
        item: new File([jsonItem], `${uuid_v4()}.json.txt`, { type: "text/plain;charset=UTF-8" }),
      };
    } catch (e) {
      console.error("Could not serialize context data to JSON.", e)
    }
  }

  return dataRef;
}
