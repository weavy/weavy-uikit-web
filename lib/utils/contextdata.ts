import { v4 as uuid_v4 } from "uuid";
import { DataRefType } from "../types/refs.types";

/**
 * Returns an URL if the object is an URL or a string that is an URL.
 *
 * @param item - string, URL or any object with .toString() function.
 * @returns
 */
export function asURL(item: unknown) {
  if (item instanceof URL) {
    return item as URL;
  } else {
    try {
      if (!item || typeof item.toString !== "function") {
        throw new Error("Unparsable string");
      }
      return new URL(item.toString());
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
  }

  return dataRef;
}
