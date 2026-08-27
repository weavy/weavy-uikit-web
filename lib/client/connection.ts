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
    callback: (realTimeEvent: T) => void | Promise<void>,
    silent?: boolean
  ) => Promise<boolean>;
  unsubscribe: <T extends RealtimeEventType | RealtimeDataType>(
    group: string | null,
    event: string,
    callback: (realTimeEvent: T) => void,
    silent?: boolean
  ) => Promise<void>;
}

/**
 * Detects whether a SignalR connection error was caused by a 401 Unauthorized response.
 *
 * SignalR wraps the negotiate failure in `FailedToNegotiateWithServerError` and only preserves the
 * original `HttpError` as a string, so the status code is not available as a property. `HttpError`
 * always formats its message as `<body>: Status code '<status>'`, which makes the status suffix the
 * only reliable thing to match on. The response body (and the HTTP/1.1 reason phrase "Unauthorized")
 * must not be relied upon: the reason phrase is empty by design on HTTP/2, and the body depends on
 * server/proxy configuration.
 */
function isUnauthorizedError(e: unknown): boolean {
  const message = (e as Error)?.toString() ?? "";
  return message.includes("Status code '401'") || message.includes("Unauthorized");
}

const RECONNECT_BASE_DELAY = 2000;
const RECONNECT_MAX_DELAY = 60000;

/**
 * Waits before the next reconnect attempt using capped exponential backoff with jitter
 * (50–100% of the capped exponential delay), so a fleet of clients does not retry a recovering
 * server in lockstep. Resolves early when the tab becomes visible or the network state changes,
 * so a returning user never waits out a long delay.
 */
function reconnectDelay(attempt: number): Promise<void> {
  const cap = Math.min(RECONNECT_MAX_DELAY, RECONNECT_BASE_DELAY * 2 ** attempt);
  const delay = Math.round(cap / 2 + Math.random() * (cap / 2));

  return new Promise<void>((resolve) => {
    const controller = new AbortController();
    const done = () => {
      clearTimeout(timer);
      controller.abort();
      resolve();
    };
    const timer = setTimeout(done, delay);
    window.addEventListener(
      "visibilitychange",
      () => {
        // wake on returning focus, not on hiding the tab
        if (document.visibilityState === "visible") {
          done();
        }
      },
      { signal: controller.signal }
    );
    // wake on network changes so the loop can re-evaluate (offline switches to waiting for online)
    window.addEventListener("online", done, { signal: controller.signal });
    window.addEventListener("offline", done, { signal: controller.signal });
  });
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
              if (isUnauthorizedError(retryContext.retryReason)) {
                // Retrying an auth failure with the same token can never succeed. Bail out of the
                // automatic reconnect so onclose -> connect() runs, which detects the 401 and
                // refreshes the token before reconnecting.
                return null;
              }
              if (!this.isDestroyed && window.navigator.onLine) {
                if (retryContext.elapsedMilliseconds < 60000) {
                  // Keep retrying with these delays for a minute (immediately, after 2s, then every 10s).
                  // Hidden tabs retry on the slow cadence instead of not at all — a backgrounded tab must
                  // still recover, otherwise it stays disconnected (and unsubscribed) until reload.
                  const reconnectDelays = [0, 2000, 10000];
                  const delay = reconnectDelays[retryContext.previousRetryCount] ?? 10000;
                  return document?.visibilityState === "hidden" ? Math.max(delay, 10000) : delay;
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
          void this._resubscribeAll();
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

    /**
     * Re-subscribes all registered event listeners on the current connection.
     *
     * SignalR groups are keyed by connection id, so every new connection starts with no group
     * memberships. SignalR's own reconnect (`onreconnected`) is not the only way a connection is
     * re-established — when its retry budget is exhausted (or skipped), `onclose` fires and
     * `connect()` starts the same `HubConnection` again with a new connection id. Both paths must
     * restore the subscriptions, otherwise the client ends up connected but never receives events.
     */
    async _resubscribeAll(this: this & WeavyType) {
      if (!this._connection) {
        return;
      }
      // subscribe() may register multiple callbacks for the same group; one Subscribe per distinct name
      const names = new Set(this._connectionEventListeners.map((listener) => listener.name));
      for (const name of names) {
        try {
          const subscribed = await this._connection.invoke<boolean | undefined>("Subscribe", name);
          if (subscribed === false) {
            console.warn(this.weavyId, "Could not restore subscription:", name);
          }
        } catch (e) {
          if (!(e instanceof DestroyError)) {
            console.warn(this.weavyId, "Error restoring subscription:", name, e);
          }
        }
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

      // Retry with a loop rather than recursion — against a server that stays down, recursive
      // retries accumulate a suspended async frame per attempt, indefinitely.
      let attempt = 0;

      while (true) {
        console.info(this.weavyId, "Connecting SignalR...");

        try {
          if (!window.navigator.onLine) {
            throw new Error();
          }

          await Promise.race([connection.start(), this.whenConnectionStarted()]);
          this.signalRAccessTokenRefresh = false;
          this.networkStateIsPending = false;
          this.serverState = "ok";
          this.connectionState = "connected";
          this._whenConnectionStartedResolve?.(connection);
          console.info(this.weavyId, `SignalR connected ${connection.connectionId}`);
          // restore group subscriptions lost with the previous connection id; overlap with pending
          // subscribe() calls is harmless since the server's group add is idempotent
          void this._resubscribeAll();
          return connection;
        } catch (e: unknown) {
          if (e instanceof DestroyError || this.isDestroyed) {
            console.warn(this.weavyId, "SignalR connection aborted.");
            return connection;
          }

          attempt++;

          if (!window.navigator.onLine) {
            this.networkStateIsPending = false;
            console.info(this.weavyId, "Offline, reconnecting SignalR when online.");
            await new Promise((r) => {
              window.addEventListener("online", r, { once: true });
            });
            // the network came back; retry quickly again
            attempt = 0;
          } else if (
            // Refresh the token on 401 regardless of tab visibility — background tabs are where dead
            // tokens accumulate, and gating recovery on visibility left them retrying forever.
            !this.signalRAccessTokenRefresh &&
            isUnauthorizedError(e)
          ) {
            // retry immediately with a fresh token, no delay
            console.info(this.weavyId, "Retrying SignalR connect with fresh token.");
            this.serverState = "unauthorized";
            this.signalRAccessTokenRefresh = true;
          } else {
            console.info(
              this.weavyId,
              "Server is probably down, retrying SignalR connect after a delay or when window regains focus."
            );
            this.connectionState = "reconnecting";
            await reconnectDelay(attempt);
          }

          // Check version in parallel to attempting to reconnect.
          void this.checkVersion();
          this.networkStateIsPending = true;
        }
      }
    }

    async subscribe<T extends RealtimeEventType | RealtimeDataType>(
      group: string | null,
      event: string,
      callback: (realtimeEvent: T) => void,
      silent: boolean = false
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
        if (!silent && !(e instanceof DestroyError)) {
          console.warn(this.weavyId, "Error in Subscribe:", e);
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
      callback: (realTimeEvent: T) => void,
      silent: boolean = false
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
        if (!silent && !(e instanceof DestroyError)) {
          console.warn(this.weavyId, "Could not unsubscribe:", e);
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
