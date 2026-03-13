/*
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

import { JsonType, PlainObjectType } from "../types/generic.types";

/**
 * Checks if an object is an object.
 *
 * @param {any} maybeObject - The object to check
 * @returns {boolean} True if the object is an object
 */
export function isObject(maybeObject: unknown): maybeObject is object {
  return Object.prototype.toString.call(maybeObject) === "[object Object]";
}

/**
 * Checks if an object is a plain object {}, similar to jQuery.isPlainObject()
 *
 * @param {object} maybePlainObject - The object to check
 * @returns {boolean} True if the object is plain
 */
export function isPlainObject(maybePlainObject: unknown): maybePlainObject is PlainObjectType {
  if (isObject(maybePlainObject as object) === false) return false;

  // If has modified constructor
  const ctor = (maybePlainObject as object).constructor;
  if (ctor === undefined) return true;

  // If has modified prototype
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const prot = ctor.prototype;
  if (isObject(prot) === false) return false;

  // If constructor does not have an Object-specific method
  if (Object.prototype.hasOwnProperty.call(prot, "isPrototypeOf") === false) {
    return false;
  }

  // Most likely a plain Object
  return true;
}

/**
 * Type guard to determine if an object has a `toJSON()` method
 * @param obj - The object to check
 * @returns boolean
 */
export function hasToJSON(obj: unknown): obj is { toJSON: () => string } {
  return typeof (obj as { toJSON?: () => string }).toJSON === "function";
}

/**
 *
 * @param maybeJSON - The object to check
 * @returns boolean
 */
export function isJSONSerializable(maybeJSON: unknown): maybeJSON is JsonType {
  return (
    typeof maybeJSON === "boolean" ||
    typeof maybeJSON === "number" ||
    typeof maybeJSON === "string" ||
    maybeJSON === null ||
    isPlainObject(maybeJSON) ||
    Array.isArray(maybeJSON)
  );
}

/**
 * Method for extending plainObjects/options, similar to Object.assign() but with deep/recursive merging. If the recursive setting is applied it will merge any plain object children. Note that Arrays are treated as data and not as tree structure when merging.
 *
 * The original options passed are left untouched.
 *
 * @param {Object} target - Original options.
 * @param {Object} properties - Merged options that will replace options from the target.
 * @param {boolean} [recursive=false] True will merge any sub-objects of the options recursively. Otherwise sub-objects are treated as data.
 * @returns {Object} A new object containing the merged options.
 */
export function assign<TTarget>(target: TTarget, properties: TTarget, recursive: boolean = false) {
  target = target || <TTarget>{};
  properties = properties || <TTarget>{};

  // Make a copy
  const copy = <TTarget>{};
  for (const property in target) {
    if (Object.prototype.hasOwnProperty.call(target, property)) {
      copy[property] = target[property];
    }
  }

  // Apply properties to copy
  for (const property in properties) {
    if (Object.prototype.hasOwnProperty.call(properties, property)) {
      if (recursive && copy[property] && isPlainObject(copy[property]) && isPlainObject(properties[property])) {
        copy[property] = assign(copy[property], properties[property], recursive);
      } else {
        copy[property] = properties[property];
      }
    }
  }
  return copy;
}

/**
 * Always returns an Array.
 *
 * @example
 * asArray(1); // [1]
 * asArray([1]); // [1]
 *
 * @param {unknown} maybeArray
 * @returns Array
 */
export function asArray<TArrayItems = unknown>(maybeArray: unknown): TArrayItems[] {
  // eslint-disable-next-line @typescript-eslint/no-unsafe-return
  return maybeArray ? (Array.isArray(maybeArray) ? maybeArray : [maybeArray as TArrayItems]) : [];
}

/**
 * Async version of Array.find()
 *
 * @param array The array to search in
 * @param predicate The predicate for the search
 * @returns Any found item.
 */
export async function findAsyncSequential<T>(
  array: T[],
  predicate: (t: T) => Promise<boolean>,
): Promise<T | undefined> {
  for (const t of array) {
    if (await predicate(t)) {
      return t;
    }
  }
  return undefined;
}

/**
 * Case insensitive string comparison
 *
 * @param {any} str1 - The first string to compare
 * @param {any} str2 - The second string to compare
 * @param {boolean} ignoreType - Skip type check and use any stringified value
 * @returns {boolean}
 */
export function eqString(str1: unknown, str2: unknown, ignoreType: boolean = false) {
  return (
    (ignoreType || (typeof str1 === "string" && typeof str2 === "string")) &&
    String(str1).toUpperCase() === String(str2).toUpperCase()
  );
}

/**
 * Compares two plain objects. Compares all the properties in a to any properties in b.
 *
 * @param {any} a - The plain object to compare with b
 * @param {any} b - The plain object to compare properties from a to
 * @param {boolean} skipLength - Do not compare the number of properties
 * @param {boolean} anyObject - Compare anything as objects
 * @returns {boolean}
 */
export function eqObjects(
  a: PlainObjectType,
  b: PlainObjectType,
  skipLength: boolean = false,
  anyObject: boolean = false,
) {
  if (!anyObject && (!isPlainObject(a) || !isPlainObject(b))) {
    return false;
  }
  if (anyObject && (!isObject(a) || !isObject(b))) {
    return false;
  }

  const aProps = Object.getOwnPropertyNames(a);
  const bProps = Object.getOwnPropertyNames(b);

  if (!skipLength && aProps.length !== bProps.length) {
    return false;
  }

  for (let i = 0; i < aProps.length; i++) {
    const propName = aProps[i];
    const propA = a[propName];
    const propB = b[propName];

    if (propA !== propB && !eqObjects(propA as PlainObjectType, propB as PlainObjectType, skipLength)) {
      return false;
    }
  }

  return true;
}

/**
 * Shifts the values and property keys.
 *
 * @param {any} obj - The plain object to reverse keys and values from
 * @returns {Object} - A new object with reversed properties.
 */
export function reversedProperties<T extends PlainObjectType<PropertyKey>>(obj: T) {
  return Object.fromEntries(Object.entries(obj).map(([key, value]) => [value, key]) as [T[keyof T], keyof T][]);
}

/**
 * Includes reversed keys and values in an object.
 * @param {any} obj - The plain object to reverse keys and values from.
 * @returns {Object} - A new object with the original properties together with reversed properties.
 */
export function includeReversedProperties<T extends PlainObjectType<PropertyKey>>(obj: T) {
  return { ...obj, ...reversedProperties(obj) };
}

/**
 * Returns the properties from an object with proper types.
 * @param obj - The plain object to get keys and values from.
 * @returns {Iterable} - An iterable array with key value pairs.
 */
export function objectAsIterable<T extends PlainObjectType, TValue = T>(obj: T) {
  return Object.entries(obj) as [keyof T, TValue][];
}

/**
 * Includes reversed keys and values in an Iterable array.
 * @param {any} obj - The plain object to reverse keys and values from.
 * @returns {Object} - An iterable array with the original properties together with reversed properties as key value pairs.
 */
export function includeReversedPropertiesAsIterable<T extends PlainObjectType<PropertyKey>>(obj: T) {
  return Object.entries(obj).concat(Object.entries(obj).map(([key, value]) => [value, key]) as [string, keyof T][]) as [
    PropertyKey,
    keyof T | T,
  ][];
}

/**
 * Removes all properties with falsy values.
 * @param {Object} obj - The object to clean.
 * @param {Boolean} recursive - Whether to clean nested objects.
 */
export function cleanFalsyProperties<T extends PlainObjectType>(obj: T, recursive = false): Partial<T> {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    let processedValue = value;

    if (Array.isArray(processedValue)) {
      // Remove empty values in array
      processedValue = processedValue.filter((x) => x);

      // Optional: If the resulting array is empty, we treat it as falsy
      if (Array.isArray(processedValue) && processedValue.length === 0) {
        return acc as T;
      }
    }

    // If recursive is enabled, check if value is an object (and not null or an array)
    if (recursive && isPlainObject(processedValue)) {
      processedValue = cleanFalsyProperties<typeof processedValue>(processedValue, true);

      // Optional: If the resulting object is empty, we treat it as falsy
      if (Object.keys(processedValue as PlainObjectType).length === 0) {
        return acc as T;
      }
    }

    // Standard falsy check (null, undefined, 0, "", false, NaN)
    if (processedValue) {
      acc[key as keyof T] = processedValue as T[keyof T];
    }

    return acc;
  }, {} as Partial<T>);
}

/**
 * Converts values in a plain object to strings. Recursive properties are flattened with dot-notation (like `"prop.subprop"`).
 *
 * @param {Object} obj - The object to convert to `Record<string, string>`
 * @param prefix
 * @returns
 */
export function flattenKeysWithValuesToStrings<T extends PlainObjectType>(obj: T, prefix = ""): Record<string, string> {
  return Object.entries(obj).reduce(
    (acc, [k, v]) => {
      const key = prefix ? `${prefix}.${k}` : k;

      if (isPlainObject(v)) {
        Object.assign(acc, flattenKeysWithValuesToStrings(v, key));
      } else {
        // eslint-disable-next-line @typescript-eslint/no-base-to-string
        acc[key] = String(v ?? "");
      }

      return acc;
    },
    {} as Record<string, string>,
  );
}

/**
 * Converts values in a plain object to strings in a key/value-array. Recursive properties are flattened with dot-notation (like `"prop.subprop"`). Array props are supported.
 *
 * @param {Object} obj - The object to convert to `Record<string, string>`
 * @param prefix
 * @returns
 */
export function flattenToSearchParams(obj: Record<string, unknown>, parentKey = ""): string[][] {
  const result: string[][] = [];

  for (const [key, value] of Object.entries(obj)) {
    const fullKey = parentKey ? `${parentKey}.${key}` : key;

    if (value === null || value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        if (item !== null && item !== undefined) {
          result.push([fullKey, String(item)]);
        }
      }
    } else if (isPlainObject(value)) {
      result.push(...flattenToSearchParams(value, fullKey));
    } else {
      // eslint-disable-next-line @typescript-eslint/no-base-to-string
      result.push([fullKey, String(value ?? "")]);
    }
  }

  return result;
}
