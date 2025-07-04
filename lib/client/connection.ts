import { WeavyClient, type WeavyType } from "./weavy";
import type { RealtimeDataType, RealtimeEventType } from "../types/realtime.types";
import { HubConnectionBuilder, HubConnection, LogLevel } from "@microsoft/signalr";
import { DestroyError } from "../utils/errors";
import type { Destructable } from "../types/weavy.types";
import { Constructor } from "../types/generic.types";

export interface WeavyConnectionProps {
  whenConnectionRequested: () => Promise<void>;
  whenConnectionStarted: () => Promise<HubConnection>;
  whenConnectionCreated: () => Promise<HubConnection>;
  createConnection: () => Promise<HubConnection>;
  disconnect: () => Promise<void>;
  connect: () => Promise<HubConnection>;
  subscribe: <T extends RealtimeEventType | RealtimeDataType>(
    group: string | null,
    event: string,
    callback: (realTimeEvent: T) => void | Promise<void>
  ) => Promise<boolean>;
  unsubscribe: <T extends RealtimeEventType | RealtimeDataType>(
    group: string | null,
    event: string,
    callback: (realTimeEvent: T) => void
  ) => Promise<void>;
}

// WeavyConnection mixin/decorator
export const WeavyConnectionMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyConnection extends Base implements WeavyConnectionProps, Destructable {
    
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      // eslint-disable-next-line @typescript-eslint/no-unsafe-argument
      super(...args);

      void this.whenConnectionRequested().then(() => {
        if (!this.isDestroyed) {
          //console.log(this.weavyId, "Weavy url and tokenFactory configured.");
          void (this as this & WeavyType).createConnection();
        }
      });
    }

    // whenConnectionRequested
    _resolveConnectionRequested?: (value: unknown) => void;

    _whenConnectionRequested = new Promise((r) => {
      this._resolveConnectionRequested = r;
    });

    async whenConnectionRequested() {
      await this._whenConnectionRequested;
    }

    // whenConnectionCreated
    _resolveConnectionCreated?: (value: HubConnection) => void;

    _whenConnectionCreated = new Promise<HubConnection>((r) => {
      this._resolveConnectionCreated = r;
    });

    async whenConnectionCreated() {
      return await this._whenConnectionCreated;
    }

    // RTM CONNECTION

    _connection?: HubConnection;
    _connectionEventListeners: Array<{ name: string; callback: (realtimeEvent: never) => void }> = [];

    signalRAccessTokenRefresh = false;

    _whenConnectionStartedResolve?: (value: HubConnection) => void;
    _whenConnectionStartedReject?: (reason: unknown) => void;
    _whenConnectionStarted = new Promise<HubConnection>((resolve, reject) => {
      this._whenConnectionStartedResolve = resolve;
      this._whenConnectionStartedReject = reject;
    });

    get rtmConnection() {
      return this._connection;
    }

    async whenConnectionStarted() {
      return await this._whenConnectionStarted;
    }

    async createConnection(this: this & WeavyType) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      this.networkStateIsPending = true;
      await this.whenUrlAndTokenFactory();

      if (this._connection) {
        const connectionUrl = new URL("/hubs/rtm", this.url);
        if (this._connection.baseUrl !== connectionUrl.toString()) {
          this.connectionState = "reconnecting";
          console.info(
            this.weavyId,
            "Reconnecting due to changed url.",
            this._connection.baseUrl,
            "=>",
            connectionUrl.toString()
          );
          await this.disconnect();
          this._connection.baseUrl = connectionUrl.toString();
          void this.connect();
        }
      } else {
        this.connectionState = "connecting";
        //console.log(this.weavyId, "Creating connection");
        const connectionUrl = new URL("/hubs/rtm", this.url);
        this._connection = new HubConnectionBuilder()
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

        this._connection.onclose(() => {
          console.info(this.weavyId, "SignalR closed.");
          this.connectionState = "disconnected";

          if (this.isDestroyed) {
            return;
          }

          this.networkStateIsPending = true;
          this._whenConnectionStarted = new Promise<HubConnection>((resolve, reject) => {
            this._whenConnectionStartedResolve = resolve;
            this._whenConnectionStartedReject = reject;
          });
          void this.connect();
        });
        this._connection.onreconnecting(() => {
          console.info(this.weavyId, "SignalR reconnecting...");
          this.connectionState = "reconnecting";
          //this.networkStateIsPending = true;
        });
        this._connection.onreconnected((connectionId) => {
          console.info(this.weavyId, `SignalR reconnected ${connectionId}`);
          this.connectionState = "connected";
          this.networkStateIsPending = false;
          for (let i = 0; i < this._connectionEventListeners.length; i++) {
            void this._connection?.invoke("Subscribe", this._connectionEventListeners[i].name);
          }
        });
        this._resolveConnectionCreated?.(this._connection);
        void this.connect();
      }

      return this._connection;
    }

    async disconnect(this: this & WeavyType) {
      if (this._connection) {
        await this._connection.stop();
        this.connectionState = "disconnected";
      }
    }

    async connect(this: this & WeavyType) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      let connection: HubConnection;
      if (this._connection) {
        connection = this._connection;
      } else {
        connection = await this.whenConnectionCreated();
      }

      console.info(this.weavyId, "Connecting SignalR...");
      //this.networkStateIsPending = true;

      try {
        if (!window.navigator.onLine) {
          throw new Error();
        }

        await Promise.race([connection.start(), this.whenConnectionStarted()]);
        this.signalRAccessTokenRefresh = false;
        this.networkStateIsPending = false;
        this.connectionState = "connected";
        this._whenConnectionStartedResolve?.(connection);
        console.info(this.weavyId, `SignalR connected ${connection.connectionId}`);
      } catch (e: unknown) {
        if (e instanceof DestroyError) {
          console.warn(this.weavyId, "SignalR connection aborted.");
          return connection;
        }
        if (!window.navigator.onLine) {
          this.networkStateIsPending = false;
          console.info(this.weavyId, "Offline, reconnecting SignalR when online.");
          await new Promise((r) => {
            window.addEventListener("online", r, { once: true });
          });
        } else {
          if (
            !this.signalRAccessTokenRefresh &&
            window.document.visibilityState !== "hidden" &&
            (e as Error).toString().includes("Unauthorized")
          ) {
            console.info(this.weavyId, "Retrying SignalR connect with fresh token.");
            this.signalRAccessTokenRefresh = true;
          } else {
            console.info(
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
        void this.checkVersion();

        // Reconnect
        this.networkStateIsPending = true;
        await this.connect();
      }
      return connection;
    }

    async subscribe<T extends RealtimeEventType | RealtimeDataType>(
      group: string | null,
      event: string,
      callback: (realtimeEvent: T) => void
    ) {
      if (this.isDestroyed) {
        throw new DestroyError();
      }

      this._resolveConnectionRequested?.(true);

      const name = group ? group + ":" + event : event;

      try {
        if (!this._connectionEventListeners) {
          // Wait for init to complete
          await new Promise((r) => queueMicrotask(() => r(true)));
        }

        if (this._connectionEventListeners.some((el) => el.name === name && el.callback === callback)) {
          throw new Error("Duplicate subscribe: " + name);
        }

        this._connectionEventListeners.push({ name, callback });

        //console.log(this.weavyId, "Subscribing", name);
        await this.whenConnectionStarted();
        if (!this._connection) {
          throw new Error("Connection not created");
        }
        this._connection.on(name, callback);
        
        const subscribed = await this._connection.invoke<boolean|undefined>("Subscribe", name) ;

        if (subscribed === false) {
          throw new Error("Could not subscribe to " + name);
        }

        return true;
      } catch (e: unknown) {
        if (!(e instanceof DestroyError)) {
          console.error(this.weavyId, "Error in Subscribe:", e);
        }

        // Clean up

        // get first occurrence of group name and remove it
        const index = this._connectionEventListeners.findIndex((el) => el.name === name && el.callback === callback);

        if (index !== -1) {
          this._connectionEventListeners.splice(index, 1);
          this._connection?.off(name, callback);
        }

        return false;
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
        const index = this._connectionEventListeners.findIndex((el) => el.name === name && el.callback === callback);

        if (index !== -1) {
          this._connectionEventListeners.splice(index, 1);

          await this.whenConnectionStarted();
          if (!this._connection) {
            throw new Error("Connection not created");
          }
          this._connection?.off(name, callback);

          // if no more groups, remove from server
          if (!this._connectionEventListeners.some((el) => el.name === name)) {
            await this._connection.invoke("Unsubscribe", name);
          }
        }
      } catch (e: unknown) {
        if (!(e instanceof DestroyError)) {
          console.error(this.weavyId, "Error in Unsubscribe:", e);
        }
      }
    }

    override destroy(this: this & WeavyType) {
      super.destroy();

      void this.disconnect();

      if (this._whenConnectionStartedReject) {
        // add default catch
        this._whenConnectionStarted.catch(() => {});
        this._whenConnectionStartedReject(new DestroyError());
      }
    }
  };
};
