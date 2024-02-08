interface Storage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

const keyPrefix = "WEAVY_OFFLINE_CACHE";
let storage: Storage | undefined;
try {
  storage = window.sessionStorage;
} catch(e) {
  console.warn("Session storage not available.");
}
const cache = new Map<PropertyKey, unknown>();

export async function getStorageItem(prefix: string, property: PropertyKey) {
  const storageItem = storage?.getItem(`${prefix}-${property.toString()}`);
  if (storageItem) {
    return JSON.parse(storageItem);
  } else {
    return undefined;
  }
}

export async function setStorageItem(prefix: string, property: PropertyKey, item: unknown) {
  const storageItem = JSON.stringify(item);

  if (storageItem) {
    storage?.setItem(`${prefix}-${property.toString()}`, storageItem);
  }
}

export async function persistProperties<T = object>(parent: T, key: string, properties: Array<keyof T>) {
  const prefix = `${keyPrefix}:${typeof parent}:${key}`;

  properties.forEach(async (property) => {
    // Try to initialize property from storage
    if (!cache.has(property)) {
      const item = await getStorageItem(prefix, property);
      if (item) {
        //console.log("Restoring property", property, item)
        parent[property] = item;
      }
      cache.set(property, item);
    }

    // Update cache and storage
    if (parent[property] !== cache.get(property)) {
      const item = parent[property];
      cache.set(property, item);
      setStorageItem(prefix, property, item);
    }
  });
}
