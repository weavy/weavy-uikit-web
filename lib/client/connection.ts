import { WeavyContext, WeavyContextType } from "./weavy-context";
import type { RealtimeDataType, RealtimeEventType } from "../types/realtime.types";
import { HubConnectionBuilder, HubConnection, LogLevel } from "@microsoft/signalr";
import { DestroyError } from "../utils/errors";
import type { WeavyContextOptionsType } from "../types/weavy.types";

export interface WeavyConnectionProps {
  whenConnectionRequested: () => Promise<void>;
  whenConnectionStarted: () => Promise<void>;
  createConnection: () => Promise<void>;
  disconnect: () => Promise<void>;
  connect: () => Promise<void>;
  subscribe: <T extends RealtimeEventType | RealtimeDataType>(
    group: string | null,
    event: string,
    callback: (realTimeEvent: T) => void
  ) => Promise<void>;
  unsubscribe: <T extends RealtimeEventType | RealtimeDataType>(
    group: string | null,
    event: string,
    callback: (realTimeEvent: T) => void
  ) => Promise<void>;
}

// WeavyConnection mixin/decorator
export const WeavyConnection = (base: typeof WeavyContext) => {
  return class WeavyConnection extends base implements WeavyConnectionProps {
    constructor(options: WeavyContextOptionsType) {
      super(options);

      this.whenConnectionRequested().then(() => {
        if (!this.isDestroyed) {
          //console.log(this.weavyId, "Weavy url and tokenFactory configured.");
          (this as this & WeavyContextType).createConnection();
        }
      });
    }

    // whenConnectionRequested
    #resolveConnectionRequested?: (value: unknown) => void;

    #whenConnectionRequested = new Promise((r) => {
      this.#resolveConnectionRequested = r;
    });

    async whenConnectionRequested() {
      await this.#whenConnectionRequested;
    }

    // RTM CONNECTION

    #connection?: HubConnection;
    #connectionEventListeners: Array<{ name: string; callback: Function }> = [];

    signalRAccessTokenRefresh = false;

    #whenConnectionStartedResolve?: (value: unknown) => void;
    #whenConnectionStartedReject?: (reason: unknown) => void;
    #whenConnectionStarted = new Promise((resolve, reject) => {
      this.#whenConnectionStartedResolve = resolve;
      this.#whenConnectionStartedReject = reject;
    });

    get rtmConnection() {
      return this.#connection;
    }

    async whenConnectionStarted() {
      await this.#whenConnectionStarted;
    }

    async createConnection(this: this & WeavyContextType) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this.url && this.tokenFactory) {
        this.networkStateIsPending = true;

        if (this.#connection) {
          const connectionUrl = new URL("/hubs/rtm", this.url);
          if (this.#connection.baseUrl !== connectionUrl.toString()) {
            this.connectionState = "reconnecting";
            console.log(
              this.weavyId,
              "Reconnecting due to changed url.",
              this.#connection.baseUrl,
              "=>",
              connectionUrl.toString()
            );
            await this.disconnect();
            this.#connection.baseUrl = connectionUrl.toString();
            this.connect();
          }
        } else {
          this.connectionState = "connecting";
          //console.log(this.weavyId, "Creating connection");
          const connectionUrl = new URL("/hubs/rtm", this.url);
          this.#connection = new HubConnectionBuilder()
            .configureLogging(LogLevel.None)
            .withUrl(connectionUrl.toString(), {
              accessTokenFactory: async () => {
                try {
                  if (this.signalRAccessTokenRefresh) {
                    //console.error(this.weavyId, "SignalR retrying with refreshed token.");
                    const token = await this.getToken(true);
                    this.signalRAccessTokenRefresh = false;
                    return token;
                  } else {
                    //console.error(this.weavyId, "first attempt")
                    const token = await this.getToken();
                    return token;
                  }
                } catch (e) {
                  console.error(e);
                  throw e;
                }
              },
            })
            .withAutomaticReconnect({
              nextRetryDelayInMilliseconds: (retryContext) => {
                if (!this.isDestroyed && window.navigator.onLine && document?.visibilityState !== "hidden") {
                  if (retryContext.elapsedMilliseconds < 60000) {
                    // Keep retrying with these delays for a minute
                    const reconnectDelays = [0, 2000, 10000];
                    return reconnectDelays[retryContext.previousRetryCount] || 10000;
                  }
                }
                return null;
              },
            })
            .build();

          this.#connection.onclose(async (_error) => {
            console.info(this.weavyId, "SignalR closed.");
            this.connectionState = "disconnected";

            if (this.isDestroyed) {
              return;
            }

            this.networkStateIsPending = true;
            this.#whenConnectionStarted = new Promise((resolve, reject) => {
              this.#whenConnectionStartedResolve = resolve;
              this.#whenConnectionStartedReject = reject;
            });
            this.connect();
          });
          this.#connection.onreconnecting((_error) => {
            console.log(this.weavyId, "SignalR reconnecting...");
            this.connectionState = "reconnecting";
            //this.networkStateIsPending = true;
          });
          this.#connection.onreconnected((_connectionId) => {
            console.info(this.weavyId, "SignalR reconnected.");
            this.connectionState = "connected";
            this.networkStateIsPending = false;
            for (let i = 0; i < this.#connectionEventListeners.length; i++) {
              this.#connection?.invoke("Subscribe", this.#connectionEventListeners[i].name);
            }
          });
          this.connect();
        }
      }
    }

    async disconnect(this: this & WeavyContextType) {
      if (this.#connection) {
        await this.#connection.stop();
        this.connectionState = "disconnected";
      }
    }

    async connect(this: this & WeavyContextType) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      if (this.#connection) {
        console.log(this.weavyId, "Connecting SignalR...");
        //this.networkStateIsPending = true;

        try {
          if (!window.navigator.onLine) {
            throw new Error();
          }

          await Promise.race([this.#connection.start(), this.whenConnectionStarted()]);
          this.signalRAccessTokenRefresh = false;
          this.networkStateIsPending = false;
          this.connectionState = "connected";
          this.#whenConnectionStartedResolve?.(undefined);
          console.info(this.weavyId, "SignalR connected.");
        } catch (e: unknown) {
          if (e instanceof DestroyError) {
            console.warn(this.weavyId, "SignalR connection aborted.");
            return;
          }
          if (!window.navigator.onLine) {
            this.networkStateIsPending = false;
            console.log(this.weavyId, "Offline, reconnecting SignalR when online.");
            await new Promise((r) => {
              window.addEventListener("online", r, { once: true });
            });
          } else {
            if (
              !this.signalRAccessTokenRefresh &&
              window.document.visibilityState !== "hidden" &&
              (e as Error).toString().includes("Unauthorized")
            ) {
              console.log(this.weavyId, "Retrying SignalR connect with fresh token.");
              this.signalRAccessTokenRefresh = true;
            } else {
              console.log(
                this.weavyId,
                "Server is probably down, retrying SignalR connect after a delay or when window regains focus."
              );
              this.connectionState = "reconnecting";
              await new Promise((r) => {
                // after timeout
                setTimeout(r, 5000);
                // or after tab gains focus again
                window.addEventListener("visibilitychange", r, { once: true });
                window.addEventListener("offline", r, { once: true });
                window.addEventListener("online", r, { once: true });
              });
            }
          }

          if (window.navigator.onLine && document?.visibilityState !== "hidden") {
            await new Promise((r) => setTimeout(r, 1000));
          }

          // Check version in parallel to attempting to reconnect.
          this.checkVersion();

          // Reconnect
          this.networkStateIsPending = true;
          await this.connect();
        }
      }
    }

    async subscribe<T extends RealtimeEventType | RealtimeDataType>(
      group: string | null,
      event: string,
      callback: (realTimeEvent: T) => void
    ) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      this.#resolveConnectionRequested?.(true);

      try {
        const name = group ? group + ":" + event : event;

        if (this.#connectionEventListeners.some((el) => el.name === name && el.callback === callback)) {
          throw new Error("Duplicate subscribe: " + name);
        }

        this.#connectionEventListeners.push({ name, callback });

        //console.log(this.weavyId, "Subscribing", name);
        await this.whenConnectionStarted();
        if (!this.#connection) {
          throw new Error("Connection not created");
        }
        this.#connection.on(name, callback);
        await this.#connection.invoke("Subscribe", name);
      } catch (e: unknown) {
        if (!(e instanceof DestroyError)) {
          console.error(this.weavyId, "Error in Subscribe:", e);
        }
      }
    }

    async unsubscribe<T extends RealtimeEventType | RealtimeDataType>(
      group: string | null,
      event: string,
      callback: (realTimeEvent: T) => void
    ) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      try {
        const name = group ? group + ":" + event : event;

        // get first occurrence of group name and remove it
        const index = this.#connectionEventListeners.findIndex((el) => el.name === name && el.callback === callback);

        if (index !== -1) {
          this.#connectionEventListeners.splice(index, 1);

          await this.whenConnectionStarted();
          if (!this.#connection) {
            throw new Error("Connection not created");
          }
          this.#connection?.off(name, callback);

          // if no more groups, remove from server
          if (!this.#connectionEventListeners.some((el) => el.name === name)) {
            await this.#connection.invoke("Unsubscribe", name);
          }
        }
      } catch (e: unknown) {
        if (!(e instanceof DestroyError)) {
          console.error(this.weavyId, "Error in Unsubscribe:", e);
        }
      }
    }

    override destroy(this: this & WeavyContextType) {
      super.destroy();

      this.disconnect();

      if (this.#whenConnectionStartedReject) {
        // add default catch
        this.#whenConnectionStarted.catch(() => {});
        this.#whenConnectionStartedReject(new DestroyError());
      }
    }
  };
};
