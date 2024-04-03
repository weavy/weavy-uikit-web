import { WeavyContext } from "./weavy-context";
import type { ConnectionState, NetworkState, NetworkStatus, ServerState } from "../types/server.types";
import { WeavyContextOptionsType } from "../types/weavy.types";

export interface WeavyNetworkProps {
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
export const WeavyNetworkMixin = (base: typeof WeavyContext) => {
  return class WeavyNetwork extends base implements WeavyNetworkProps {
    constructor(options: WeavyContextOptionsType) {
      super(options);

      window.addEventListener("online", () => {
        this.networkState = "online";
      });

      window.addEventListener("offline", () => {
        this.networkState = "offline";
        this.networkStateIsPending = false;
      });
    }
    // NETWORK

    _networkEvents = new Set<(status: NetworkStatus) => void>();
    _connectionState: ConnectionState = "connecting";
    _serverState: ServerState = "ok";
    _networkState: NetworkState = window.navigator.onLine ? "online" : "offline";
    _networkStateIsPending: boolean = false;

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
            ? this._connectionState === "connected" || this._serverState === "ok"
              ? "online"
              : "unreachable"
            : "offline",
        isPending: this._networkStateIsPending,
      };
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
