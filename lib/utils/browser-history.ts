import { PlainObjectType } from "../types/generic.types";
import { throwOnDomNotAvailable } from "./dom";
import { assign, eqObjects, isPlainObject } from "./objects";

/**
 * Gets the global state for all weavy instances combined, stored in the browser history state.
 * The state has the same structure as a single weavy instance state.
 *
 * @param {string} id - The group identifier for storage.
 * @returns {object}
 */
export function getBrowserStateProperty<T>(prefix: string, property: PropertyKey) {
  throwOnDomNotAvailable();

  const historyState = assign<PlainObjectType>({} as PlainObjectType, window.history.state as PlainObjectType, true);
  if (!historyState.weavy || !(historyState.weavy as PlainObjectType)[prefix] || !Object.hasOwn((historyState.weavy as PlainObjectType)[prefix] as PlainObjectType, property)) {
    //console.log("property not found", window.history.state)
    throw new Error("Property not found");
  }

  const prefixedState = (historyState.weavy as PlainObjectType)[prefix];
  const value = (prefixedState as PlainObjectType)[property];
  return value as T;
}

/**
 * Saves a weavy state to the browser history by either push or replace.
 * Any existing state will be preserved and existing states from other weavy instances will be merged.
 *
 * @param {string} id - The group id for storage.
 * @param {any} state - The state to add to any existing state
 * @param {string} [action] - If set to "replace", the current history state will be updated.
 * @param {any} [url] - Any new url to use for the state. If omitted, the current location will be reused.
 */
export function setBrowserState(prefix: string, state: unknown, action: "push" | "replace" = "push", url?: URL | string) {
  throwOnDomNotAvailable();

  if (state) {
    //console.debug(action + ' browser state', state)

    // Always modify any existing state

    const currentHistoryState = assign<PlainObjectType>({} as PlainObjectType, window.history.state as PlainObjectType, true);
    currentHistoryState.weavy ??= {} as PlainObjectType;

    (currentHistoryState.weavy as PlainObjectType)[prefix] = state;

    url = (url && String(url)) || window.location.href;

    try {
      if (action === "replace") {
        window.history.replaceState(currentHistoryState, "", url);
      } else {
        window.history.pushState(currentHistoryState, "", url);
      }
    } catch (e) {
      console.warn("history: Could not push history state.", e, state);
    }
  }
}

export function restoreHistoryProperties<T = PlainObjectType>(parent: T, key: string, properties: Array<keyof T>) {
  throwOnDomNotAvailable();
  
  const prefix = `${typeof parent}:${key}`;

  properties.forEach((property: keyof T) => {
    // Try to initialize property from history
    try {
      const item = getBrowserStateProperty(prefix, property);
      //console.log('Restoring history property', property, item)
      const currentValue = parent[property];
      
      if (itemHasChanged(currentValue, item)) {
        (parent[property] as unknown) = item;
      }
    } catch {
      /* no worries */
    }
  });
}

export function pushHistoryProperties<T = object>(
  parent: T,
  key: string,
  properties: Array<keyof T>,
  action: "push" | "replace" = "push"
) {
  throwOnDomNotAvailable();
  
  const prefix = `${typeof parent}:${key}`;
  const state: PlainObjectType = {};

  properties.forEach((property) => {
    // Push history
    state[property] = parent[property];
  });

  setBrowserState(prefix, state, action);
}

export function updateHistoryProperties<T = object>(parent: T, key: string, properties: Array<keyof T>) {
  pushHistoryProperties(parent, key, properties, "replace");
}

export function itemHasChanged(a: unknown, b: unknown) {
  if (a && b && (isPlainObject(a) || isPlainObject(b))) {
    if (a && Object.hasOwn(a as object, "id") || b && Object.hasOwn(b as object, "id")) {
      return (a as unknown as { id: unknown }).id !== (b as unknown as { id: unknown }).id;
    } else {
      return !eqObjects(a as PlainObjectType, b as PlainObjectType);
    }
  } else {
    return a !== b;
  }
}