import { ReactiveController, ReactiveControllerHost } from "lit";
import { persistProperties, resetPersistPropertiesCache } from "../utils/persist-properties";
import { WeavyType } from "../client/weavy";

export class PersistStateController<T = ReactiveControllerHost> implements ReactiveController {
  host: ReactiveControllerHost;
  #prefixKey: string = "";
  #cachePrefix?: string;
  properties: Array<keyof T> = [];

  get prefixKey() {
    return this.#prefixKey;
  }

  set prefixKey(prefixKey) {
    if (prefixKey !== this.#prefixKey) {
      resetPersistPropertiesCache();
      this.#prefixKey = prefixKey;
      this.host.requestUpdate();
    }
  }

  get cachePrefix() {
    return this.#cachePrefix;
  }

  set cachePrefix(cachePrefix) {
    if (cachePrefix !== this.#cachePrefix) {
      resetPersistPropertiesCache();
      this.#cachePrefix = cachePrefix;
      this.host.requestUpdate();
    }
  }

  constructor(host: ReactiveControllerHost, prefixKey?: string, properties?: Array<keyof T>, cachePrefix?: string) {
    host.addController(this);
    this.host = host;

    if (properties) {
      this.properties = properties;
    }

    if (prefixKey) {
      this.#prefixKey = prefixKey;
    }

    if (cachePrefix) {
      this.cachePrefix = cachePrefix;
    }
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
    if (this.prefixKey && this.properties) {
      const weavy = (this.host as unknown as this & { weavy: WeavyType }).weavy;
      persistProperties<T>(this.host as T, this.prefixKey, this.properties, this.cachePrefix || weavy?.cachePrefix);
    }
  }
}
