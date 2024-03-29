import { ReactiveController, ReactiveControllerHost } from "lit";
import { persistProperties, resetPersistPropertiesCache } from "../utils/persist-properties";

export class PersistStateController<T = ReactiveControllerHost> implements ReactiveController {
  host: ReactiveControllerHost;
  #prefixKey: string = "";
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

  constructor(host: ReactiveControllerHost, prefixKey?: string, properties?: Array<keyof T>) {
    host.addController(this);
    this.host = host;

    if (properties) {
      this.properties = properties;
    }

    if (prefixKey) {
      this.#prefixKey = prefixKey;
    }
  }

  public observe(properties: Array<keyof T>, prefixKey?: string) {
    this.properties = properties;

    if (prefixKey) {
      this.prefixKey = prefixKey;
    }
  }

  hostUpdate() {
    if (this.prefixKey && this.properties) {
      persistProperties<T>(this.host as T, this.prefixKey, this.properties);
    }
  }
}
