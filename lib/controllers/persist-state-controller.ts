import { PropertyValueMap, ReactiveController, ReactiveControllerHost } from "lit";
import { type PersistProp, PersistStorageCache } from "../utils/persist-properties";
import { WeavyComponentContextProps } from "../types/component.types";

export class PersistStateController<T extends ReactiveControllerHost & WeavyComponentContextProps> implements ReactiveController {
  host: T;
  #prefixKey: string = "";
  #cachePrefix?: string;
  properties: Array<PersistProp<T>> = [];
  initialProperties: Map<keyof T, unknown> = new Map()
  callback?: (changedProperties: PropertyValueMap<T>) => void

  persistStorageCache = new PersistStorageCache();

  get prefixKey() {
    return this.#prefixKey;
  }

  set prefixKey(prefixKey) {
    if (prefixKey !== this.#prefixKey) {
      this.persistStorageCache.resetPersistPropertiesCache();
      this.#prefixKey = prefixKey;
      this.host.requestUpdate();
    }
  }

  get cachePrefix() {
    return this.#cachePrefix;
  }

  set cachePrefix(cachePrefix) {
    if (cachePrefix !== this.#cachePrefix) {
      this.persistStorageCache.resetPersistPropertiesCache();
      this.#cachePrefix = cachePrefix;
      this.host.requestUpdate();
    }
  }

  constructor(host: T) {
    host.addController(this);
    this.host = host;
  }

  public observe(properties: Array<PersistProp<T>>, prefixKey?: string, cachePrefix?: string, callback?: (changedProperties: PropertyValueMap<T>) => void) {
    this.properties = properties;
    this.callback = callback

    const prefixHasChanged = Boolean(this.prefixKey && this.prefixKey !== prefixKey || this.cachePrefix && this.cachePrefix !== cachePrefix);

    this.properties.forEach((prop) => {
      if (prefixHasChanged && this.initialProperties.has(prop.name)) {
        // Reset to initial when needed
        this.host[prop.name] = this.initialProperties.get(prop.name) as T[keyof T];
      } else if (!this.initialProperties.has(prop.name)) {
        this.initialProperties.set(prop.name, this.host[prop.name])
      }
    })

    if (prefixKey) {
      this.prefixKey = prefixKey;
    }

    if (cachePrefix) {
      this.cachePrefix = cachePrefix;
    }
  }

  hostUpdate() {
    if (this.prefixKey && this.properties && this.host.weavy) {
      this.persistStorageCache.persistProperties<T>(this.host, this.prefixKey, this.properties, this.cachePrefix ? `${this.host.weavy.cachePrefix}:${this.cachePrefix}` : this.host.weavy.cachePrefix, this.callback);
    }
  }
}
