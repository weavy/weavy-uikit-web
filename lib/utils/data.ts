import { PlainObjectType } from "../types/generic.types";
import { hasToJSON, isPlainObject } from "./objects";
import { toCamelCase, toSnakeCase } from "./strings";

export const defaultFetchSettings: RequestInit = {
  //mode: 'cors', // no-cors, *cors, same-origin
  // cache: 'default' means the server is in control of the caching which is preferred instead of using 'reload'
  //cache: 'default', // *default, no-cache, reload, force-cache, only-if-cached
  credentials: "omit" as RequestCredentials, // include, *same-origin, omit
  headers: {
    // https://stackoverflow.com/questions/8163703/cross-domain-ajax-doesnt-send-x-requested-with-header
    "X-Requested-With": "XMLHttpRequest",
  } as HeadersInit & { "X-Requested-With": "XMLHttpRequest" },
  redirect: "manual" as RequestRedirect, // manual, *follow, error
  //referrerPolicy: 'no-referrer-when-downgrade', // no-referrer, *no-referrer-when-downgrade, origin, origin-when-cross-origin, same-origin, strict-origin, strict-origin-when-cross-origin, unsafe-url
};

/**
 * Removes HTMLElement and Node from object before serializing. Used with JSON.stringify().
 *
 * @example
 * var jsonString = JSON.stringify(data, sanitizeJSON);
 *
 * @param {string} key
 * @param {any} value
 * @returns {any} - Returns the value or undefined if removed.
 */
export function sanitizeJSON(_key: string, value: unknown) {
  // Filtering out DOM Elements and nodes
  if (value instanceof HTMLElement || value instanceof Node) {
    return undefined;
  }
  return value;
}

/**
 * Returns a replacer function to use with JSON.stringify to ensure the object doesn't have circular references.
 * @returns {Function} replacer function
 */
export function getCircularReferenceReplacer() {
  const seen = new WeakSet();

  const replacer = function (key: string | number, value: unknown): unknown {
    // Handle objects with a custom `.toJSON()` method.
    if (hasToJSON(value)) {
      value = value.toJSON();
    }

    if (!(value !== null && typeof value === "object")) {
      return value;
    }

    if (seen.has(value)) {
      return "[Circular]";
    }

    let returnValue;

    seen.add(value);

    if (isPlainObject(value)) {
      const n: PlainObjectType = {};

      Object.keys(value).forEach((k) => {
        n[k] = replacer(k, value[k as keyof typeof value]);
      });

      returnValue = n;
    } else if (Array.isArray(value)) {
      returnValue = value.map((v, k) => {
        return replacer(k, v);
      });
    }

    seen.delete(value);

    return returnValue;
  };

  return replacer;
}

/**
 * Changes all object keys recursively to camelCase from PascalCase, spinal-case and snake_case.
 *
 * @param {Object} obj - The object containing keys to process
 * @param {boolean} pascal - Make keys PascalCase
 * @returns {Object} The processed object with any camelCase or PascalCase keys
 */
export function keysToCamelCase(obj: object, pascal?: boolean): object {
  if (isPlainObject(obj)) {
    const n: PlainObjectType = {};

    Object.keys(obj).forEach((k) => {
      n[toCamelCase(k, pascal)] = keysToCamelCase(obj[k] as PlainObjectType, pascal);
    });

    return n;
  } else if (Array.isArray(obj)) {
    return obj.map((o) => {
      return keysToCamelCase(o as PlainObjectType, pascal);
    });
  }

  return obj;
}

/**
 * Changes all object keys recursively to PascalCase from camelCase, spinal-case and snake_case.
 *
 * @param {Object} obj - The object containing keys to process
 * @returns {Object} The processed object with any PascalCase keys
 */
export function keysToPascalCase(obj: PlainObjectType) {
  return keysToCamelCase(obj, true);
}

/**
 * Serializes a form to an object with data.
 *
 * @param {HTMLFormElement} form - The form to serialize
 * @param {boolean} snake_case - Use snake case for property names
 * @returns {Object}
 */
export function serializeObject(form: HTMLFormElement, snake_case: boolean) {
  snake_case = snake_case || false;
  const o: PlainObjectType = {};
  const d = new FormData(form);

  d.forEach((value, name) => {
    const n = snake_case ? toSnakeCase(name) : name;
    if (o[n] !== undefined) {
      if (!Array.isArray(o[n])) {
        o[n] = [o[n]];
      }
      (o[n] as Array<typeof value>).push(value || "");
    } else {
      o[n] = value || "";
    }
  });
  return o;
}

/**
 * Generate a S4 alphanumeric 4 character sequence suitable for non-sensitive GUID generation etc.
 */
export function S4() {
  return (((1 + Math.random()) * 0x10000) | 0).toString(16).substring(1);
}

export function getTextStreamFromResponse(response: Response) {
  if (response && response.ok && response.body) {
    const reader = response.body.getReader();
    return new ReadableStream({
      start(controller) {
        const pump: () => Promise<void> = () => {
          return reader.read().then(({ done, value }) => {
            // When no more data needs to be consumed, close the stream
            if (done) {
              controller.close();
              return;
            }
            // Enqueue the next data chunk into our target stream
            controller.enqueue(value);
            return pump();
          });
        };

        return pump();
      },
    });
  } else {
    throw new Error("Could not parse text stream");
  }
}

export function getStorage(type: "sessionStorage" | "localStorage" | "sharedStorage") {
  let storage: Storage | undefined;
  try {
    storage = window[type as keyof typeof window] as Storage | undefined;
    if (storage) {
      const x = "__storage_test__";
      storage.setItem(x, x);
      storage.removeItem(x);
    }
  } catch (e) {
    if (
      e instanceof DOMException &&
      e.name === "QuotaExceededError" &&
      // acknowledge QuotaExceededError only if there's something already stored
      storage &&
      storage.length !== 0
    ) {
      console.error("Storage not available:", type);
    }
  }
  return storage;
}
