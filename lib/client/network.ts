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
export const WeavyNetwork = (base: typeof WeavyContext) => {
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

    #networkEvents = new Set<(status: NetworkStatus) => void>();
    #connectionState: ConnectionState = "connecting";
    #serverState: ServerState = "ok";
    #networkState: NetworkState = window.navigator.onLine ? "online" : "offline";
    #networkStateIsPending: boolean = false;

    get networkState() {
      return this.#networkState;
    }

    set networkState(state: NetworkState) {
      this.#networkState = state;
      this.triggerNetworkChange();
    }

    get serverState() {
      return this.#serverState;
    }

    set serverState(state: ServerState) {
      this.#serverState = state;
      this.triggerNetworkChange();
    }

    get connectionState() {
      return this.#connectionState;
    }

    set connectionState(state: ConnectionState) {
      this.#connectionState = state;
      this.triggerNetworkChange();
    }

    get networkStateIsPending() {
      return this.#networkStateIsPending;
    }

    set networkStateIsPending(isPending: boolean) {
      this.#networkStateIsPending = isPending;
      this.triggerNetworkChange();
    }

    get network(): NetworkStatus {
      return {
        state:
          this.#networkState === "online"
            ? this.#connectionState === "connected" || this.#serverState === "ok"
              ? "online"
              : "unreachable"
            : "offline",
        isPending: this.#networkStateIsPending,
      };
    }

    triggerNetworkChange() {
      const networkStatus = this.network;
      //console.log(this.weavyId, "network status changed", networkStatus);
      this.#networkEvents.forEach((eventHandler) => {
        eventHandler(networkStatus);
      });
    }

    addNetworkListener(callback: (state: NetworkStatus) => void) {
      this.#networkEvents.add(callback);
    }

    removeNetworkListener(callback: (state: NetworkStatus) => void) {
      this.#networkEvents.delete(callback);
    }
  };
};
