/*
 * is-plain-object <https://github.com/jonschlinkert/is-plain-object>
 *
 * Copyright (c) 2014-2017, Jon Schlinkert.
 * Released under the MIT License.
 */

import { PlainObjectType } from "../types/generic.types";

/**
 * Checks if an object is an object.
 *
 * @param {any} maybeObject - The object to check
 * @returns {boolean} True if the object is an object
 */
export function isObject(maybeObject: unknown) {
  return Object.prototype.toString.call(maybeObject) === "[object Object]";
}

/**
 * Checks if an object is a plain object {}, similar to jQuery.isPlainObject()
 *
 * @param {Object} maybePlainObject - The object to check
 * @returns {boolean} True if the object is plain
 */
export function isPlainObject(maybePlainObject: unknown) {
  if (isObject(maybePlainObject as Object) === false) return false;

  // If has modified constructor
  const ctor = (maybePlainObject as Object).constructor;
  if (ctor === undefined) return true;

  // If has modified prototype
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
 * Method for extending plainObjects/options, similar to Object.assign() but with deep/recursive merging. If the recursive setting is applied it will merge any plain object children. Note that Arrays are treated as data and not as tree structure when merging.
 *
 * The original options passed are left untouched.
 *
 * @param {Object} source - Original options.
 * @param {Object} properties - Merged options that will replace options from the source.
 * @param {boolean} [recursive=false] True will merge any sub-objects of the options recursively. Otherwise sub-objects are treated as data.
 * @returns {Object} A new object containing the merged options.
 */
export function assign<TSource>(source: TSource | PlainObjectType, properties: PlainObjectType, recursive: boolean = false) {
  source = source as PlainObjectType || {};
  properties = properties || {};

  // Make a copy
  const copy: PlainObjectType = {};
  for (const property in source) {
    if (Object.prototype.hasOwnProperty.call(source, property)) {
      copy[property] = source[property];
    }
  }

  // Apply properties to copy
  for (const property in properties) {
    if (Object.prototype.hasOwnProperty.call(properties, property)) {
      if (recursive && copy[property] && isPlainObject(copy[property]) && isPlainObject(properties[property])) {
        copy[property] = assign(copy[property] as PlainObjectType, properties[property] as PlainObjectType, recursive);
      } else {
        copy[property] = properties[property];
      }
    }
  }
  return copy as TSource;
}

/**
 * Always returns an Array.
 *
 * @example
 * asArray(1); // [1]
 * asArray([1]); // [1]
 *
 * @param {any} maybeArray
 * @returns {Array}
 */
export function asArray(maybeArray: unknown) {
  return (maybeArray && (Array.isArray(maybeArray) ? maybeArray : [maybeArray])) || [];
}

/**
 * Case insensitive string comparison
 *
 * @param {any} str1 - The first string to compare
 * @param {any} str2 - The second string to compare
 * @param {boolean} ignoreType - Skip type check and use any stringified value
 * @returns {boolean}
 */
export function eqString(str1: string | unknown, str2: string | unknown, ignoreType: boolean = false) {
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
export function eqObjects(a: PlainObjectType, b: PlainObjectType, skipLength: boolean = false, anyObject: boolean = false) {
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
