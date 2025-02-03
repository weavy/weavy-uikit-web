import { ReactiveController, ReactiveControllerHost } from "lit";
import { PersistStorageCache } from "../utils/persist-properties";
import { WeavyComponentContextProps } from "../classes/weavy-component";

export class PersistStateController<T extends ReactiveControllerHost & WeavyComponentContextProps> implements ReactiveController {
  host: T;
  #prefixKey: string = "";
  #cachePrefix?: string;
  properties: Array<keyof T> = [];

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

  public observe(properties: Array<keyof T>, prefixKey?: string, cachePrefix?: string) {
    this.properties = properties;

    if (prefixKey) {
      this.prefixKey = prefixKey;
    }

    if (cachePrefix) {
      this.cachePrefix = cachePrefix;
    }
  }

  hostUpdate() {
    if (this.prefixKey && this.properties && this.host.weavy) {
      this.persistStorageCache.persistProperties<T>(this.host as T, this.prefixKey, this.properties, this.cachePrefix ? `${this.host.weavy.cachePrefix}:${this.cachePrefix}` : this.host.weavy.cachePrefix);
    }
  }
}
