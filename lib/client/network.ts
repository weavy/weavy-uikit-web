import { WeavyClient } from "./weavy";
import type { ConfigurationState, ConnectionState, NetworkState, NetworkStatus, ServerState } from "../types/server.types";
import { Constructor } from "../types/generic.types";

export interface WeavyNetworkProps {
  configurationState: ConfigurationState;
  networkState: NetworkState;
  serverState: ServerState;
  connectionState: ConnectionState;
  networkStateIsPending: boolean;
  readonly network: NetworkStatus;
  triggerNetworkChange: () => void;
  addNetworkListener: (callback: (state: NetworkStatus) => void) => void;
  removeNetworkListener: (callback: (state: NetworkStatus) => void) => void;
}

// WeavyNetwork mixin/decorator
export const WeavyNetworkMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyNetwork extends Base implements WeavyNetworkProps {
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);

      window.addEventListener("online", () => {
        this.networkState = "online";
      });

      window.addEventListener("offline", () => {
        this.networkState = "offline";
        this.networkStateIsPending = false;
      });

      queueMicrotask(() => this.requestConfigurationCheck());
    }
    // NETWORK

    _configurationState: ConfigurationState = "pending";
    _configurationTimer?: number | null;
    _networkEvents = new Set<(status: NetworkStatus) => void>();
    _connectionState: ConnectionState = "connecting";
    _serverState: ServerState = "ok";
    _networkState: NetworkState = window.navigator.onLine ? "online" : "offline";
    _networkStateIsPending: boolean = false;

    get configurationState() {
      return this._configurationState;
    }

    set configurationState(state: ConfigurationState) {
      this._configurationState = state;
      if (this._configurationTimer && state === "configured") {
        window.clearTimeout(this._configurationTimer);
        this._configurationTimer = null;
      }
      this.triggerNetworkChange();
    }

    get networkState() {
      return this._networkState;
    }

    set networkState(state: NetworkState) {
      this._networkState = state;
      this.triggerNetworkChange();
    }

    get serverState() {
      return this._serverState;
    }

    set serverState(state: ServerState) {
      this._serverState = state;
      this.triggerNetworkChange();
    }

    get connectionState() {
      return this._connectionState;
    }

    set connectionState(state: ConnectionState) {
      this._connectionState = state;
      this.triggerNetworkChange();
    }

    get networkStateIsPending() {
      return this._networkStateIsPending;
    }

    set networkStateIsPending(isPending: boolean) {
      this._networkStateIsPending = isPending;
      this.triggerNetworkChange();
    }

    get network(): NetworkStatus {
      return {
        state:
          this._networkState === "online"
            ? (this._connectionState === "connected" || this._serverState === "ok") && this.configurationState !== "uninitialized"
              ? "online"
              : "unreachable"
            : "offline",
        isPending: this._networkStateIsPending,
      };
    }

    requestConfigurationCheck() {
      if (!this._configurationTimer && this.configurationTimeout >= 0 && this.configurationTimeout < Infinity) {
        this._configurationTimer = window.setTimeout(() => {
          if (this.configurationState === "pending") {
            this.configurationState = "uninitialized";
            console.error("Weavy was not configured with required url and tokenFactory/tokenUrl within a reasonable time. Please check your configuration!")
          }
          this._configurationTimer = null;
        }, this.configurationTimeout)
      }
    }

    triggerNetworkChange() {
      const networkStatus = this.network;
      //console.log(this.weavyId, "network status changed", networkStatus);
      this._networkEvents.forEach((eventHandler) => {
        eventHandler(networkStatus);
      });
    }

    addNetworkListener(callback: (state: NetworkStatus) => void) {
      this._networkEvents.add(callback);
    }

    removeNetworkListener(callback: (state: NetworkStatus) => void) {
      this._networkEvents.delete(callback);
    }
  };
};
