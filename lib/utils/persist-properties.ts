import { throwOnDomNotAvailable } from "./dom";

export interface Storage {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
}

export type PersistProp<T extends object> = { name: keyof T, override: boolean }

export class PersistStorageCache {
  #cache = new Map<PropertyKey, unknown>();
  #storage: Storage | undefined;

  keyPrefix = "WEAVY_OFFLINE_CACHE";

  constructor(storage?: Storage) {

    if (storage) {
      this.#storage = storage
    } else {
      try {
        throwOnDomNotAvailable();
        
        this.#storage = window.sessionStorage;
      } catch {
        console.warn("Session storage not available.");
      }
    }
  }
  
  resetPersistPropertiesCache() {
    this.#cache.clear();
  }

  async getStorageItem(prefix: string, property: PropertyKey) {
    const storageItem = this.#storage?.getItem(`${prefix}-${property.toString()}`);
    if (storageItem) {
      return JSON.parse(storageItem);
    } else {
      return undefined;
    }
  }

  async setStorageItem(prefix: string, property: PropertyKey, item: unknown) {
    const storageItem = JSON.stringify(item);
  
    if (storageItem) {
      this.#storage?.setItem(`${prefix}-${property.toString()}`, storageItem);
    }
  }

  async persistProperties<T extends object = object>(parent: T, key: string, properties: Array<PersistProp<T>>, cachePrefix?: string) {
    const prefix = `${this.keyPrefix}:${cachePrefix ? `${cachePrefix}:` : ''}${typeof parent}:${key}`;
  
    properties.forEach(async (property) => {
      // Try to initialize property from storage
      if (!this.#cache.has(property.name)) {
        const item = await this.getStorageItem(prefix, property.name);
        if (item && (property.override || !parent[property.name])) {
          //console.log("Restoring property", property, item)
          parent[property.name] = item;
        }
        this.#cache.set(property.name, item);
      }
  
      // Update cache and storage
      if (parent[property.name] !== this.#cache.get(property.name)) {
        const item = parent[property.name];
        this.#cache.set(property.name, item);
        this.setStorageItem(prefix, property.name, item);
      }
    });
  }
  
}





