import { ReactiveController, ReactiveControllerHost } from "lit";
import {
  getBrowserStateProperty,
  pushHistoryProperties,
  restoreHistoryProperties,
  setBrowserState,
  updateHistoryProperties,
} from "../utils/browser-history";

export class HistoryController<T = ReactiveControllerHost> implements ReactiveController {
  host: ReactiveControllerHost;
  prefixKey?: string;
  properties?: Array<keyof T>;
  prevPropertyValues?: { [key: PropertyKey]: unknown };

  private _backCount = 0;

  constructor(host: ReactiveControllerHost, prefixKey?: string, properties?: Array<keyof T>) {
    host.addController(this);
    this.host = host;

    if (properties) {
      this.properties = properties;
    }

    if (prefixKey) {
      this.prefixKey = prefixKey;
      try {
        this._backCount = getBrowserStateProperty(this.prefixKey, "_backCount") || this._backCount;
      } catch (e) {
        /* No worries */
      }
    }
  }

  public get hasBackNavigation() {
    return this._backCount > 0;
  }

  public back() {
    window.history.back();
  }

  public backAll() {
    //console.log("closeAll", this._backCount)
    window.history.go(this._backCount * -1);
  }

  public observe(properties: Array<keyof T>, prefixKey?: string) {
    this.properties = properties;

    if (prefixKey) {
      this.prefixKey = prefixKey;
      try {
        this._backCount = getBrowserStateProperty(this.prefixKey, "_hasBack") || this._backCount;
      } catch (e) {
        /* No worries */
      }
    }
  }

  /**
   * Method to manually push history
   */
  public pushCurrentState() {
    if (this.prefixKey) {
      pushHistoryProperties<T>(this.host as T, this.prefixKey, this.properties as (keyof T)[]);
      this._backCount++;
      setBrowserState(this.prefixKey, { _backCount: this._backCount }, "replace");
    }
  }

  private updatePrevPropertyValues() {
    if (this.properties) {
      this.prevPropertyValues ??= {};

      this.properties.forEach((property) => {
        //console.log("updating prev value", property, (this.host as T)[property as (keyof T)])
        this.prevPropertyValues![property] = (this.host as T)[property as keyof T];
      });
    }
  }

  private restoreHistory = () => {
    if (this.prefixKey && this.properties) {
      //console.log("restore history state", this.prefixKey)
      restoreHistoryProperties<T>(this.host as T, this.prefixKey, this.properties as (keyof T)[]);
      try {
        this._backCount = getBrowserStateProperty(this.prefixKey, "_backCount") || 0;
      } catch (e) {
        this._backCount = 0;
      }
      this.updatePrevPropertyValues();
    }
  };

  hostConnected(): void {
    window.addEventListener("popstate", this.restoreHistory);
  }

  hostUpdated() {
    if (this.prefixKey && this.properties) {
      if (this.prevPropertyValues) {
        const anyPropertyHasChanged = this.properties.some(
          (property) => this.prevPropertyValues![property] !== (this.host as T)[property as keyof T]
        );

        if (anyPropertyHasChanged) {
          //console.log("push history state", this.prefixKey)
          pushHistoryProperties<typeof this.prevPropertyValues>(
            this.prevPropertyValues,
            this.prefixKey,
            this.properties as (keyof T)[]
          );
          this._backCount++;
          setBrowserState(this.prefixKey, { _backCount: this._backCount }, "replace");
        }
      } else {
        this.prevPropertyValues = {};
      }

      //console.log("update history state")
      updateHistoryProperties(this.host as T, this.prefixKey, this.properties as (keyof T)[]);
      this.updatePrevPropertyValues();
    }
  }

  hostDisconnected() {
    window.removeEventListener("popstate", this.restoreHistory);
  }
}
