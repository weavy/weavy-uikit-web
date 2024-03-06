import { LocaleModule, configureLocalization } from "@lit/localize";
import { QueryClient, type Mutation } from "@tanstack/query-core";
import { HubConnectionBuilder, HubConnection, LogLevel } from "@microsoft/signalr";
import { modalController } from "lit-modal-portal";
import WeavyPortal from "../components/wy-portal";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import {
  type Persister,
  persistQueryClientRestore,
  persistQueryClientSubscribe,
} from "@tanstack/query-persist-client-core";

import { assign } from "../utils/objects";
import { S4, defaultFetchSettings } from "../utils/data";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { globalContextProvider, weavyContextDefinition } from "./context-definition";
import { defer, observeConnected } from "../utils/dom";
import { chrome } from "../utils/browser";

import type { WeavyTokenFactory, WeavyOptions } from "../types/weavy.types";
import type { FileMutationContextType } from "../types/files.types";
import type { RealtimeDataType, RealtimeEventType } from "../types/realtime.types";
import type { ConnectionState, NetworkState, NetworkStatus, ServerState } from "../types/server.types";
import type { PlainObjectType } from "../types/generic.types";
import { HeaderContentType, type HttpMethodType, type HttpUploadMethodType } from "../types/http.types";

import colorModes from "../scss/colormodes";
import { adoptGlobalStyles } from "../utils/styles";
import { toUrl } from "../converters/url";

/**
 * The locale used in the source files.
 */
const SOURCE_LOCALE = "en";

export class DestroyError extends Error {
  override name = "DestroyError";

  constructor() {
    super("Instance destroyed");
  }
}
/**
 * Context for Weavy that handles communication with the server, data handling and common options.
 * Requires a `url` to the Weavy environment and an async `tokenFactory` that provides user access tokens.
 */
export class WeavyContext implements WeavyOptions {
  /**
   * The semver version of the package.
   */
  static readonly version: string = WEAVY_VERSION;
  readonly version: string = WeavyContext.version;

  /**
   * The Weavy source name; package name.
   */
  static readonly sourceName: string = WEAVY_SOURCE_NAME;

  /**
   * The locale used in the Weavy source.
   */
  static readonly sourceLocale = SOURCE_LOCALE;

  // CONFIG

  static defaults: WeavyOptions = {
    cloudFilePickerUrl: "https://filebrowser.weavy.io/v14/",
    confluenceAuthenticationUrl: undefined,
    confluenceProductName: undefined,
    disableEnvironmentImports: false,
    gcTime: 1000 * 60 * 60 * 24, // 24h,
    locale: SOURCE_LOCALE,
    modalParent: "body",
    reactions: ["😍", "😎", "😉", "😜", "👍"],
    scrollBehavior: chrome ? "instant" : "smooth",
    staleTime: 1000 * 1, // 1s
    tokenFactoryRetryDelay: 2000,
    tokenFactoryTimeout: 20000,
    zoomAuthenticationUrl: undefined,
  };

  readonly weavySid: string = S4();
  readonly weavyId: string = `${WeavyContext.sourceName}#${this.weavySid}`;

  #isDestroyed = false;

  get isDestroyed() {
    return this.#isDestroyed;
  }

  /**
   * The host where the Weavy context is provided.
   */
  readonly host: HTMLElement = document.documentElement;

  #hostContextProvider?: ContextProvider<typeof weavyContextDefinition>;
  #modalContextProvider?: ContextProvider<typeof weavyContextDefinition>;

  #hostIsConnectedObserver: ResizeObserver;

  // OPTIONS

  cloudFilePickerUrl = WeavyContext.defaults.cloudFilePickerUrl;
  confluenceAuthenticationUrl = WeavyContext.defaults.confluenceAuthenticationUrl;
  confluenceProductName = WeavyContext.defaults.confluenceProductName;
  disableEnvironmentImports = WeavyContext.defaults.disableEnvironmentImports;
  gcTime = WeavyContext.defaults.gcTime;
  modalParent = WeavyContext.defaults.modalParent;
  reactions = WeavyContext.defaults.reactions;
  scrollBehavior = WeavyContext.defaults.scrollBehavior;
  staleTime = WeavyContext.defaults.staleTime;
  tokenFactoryRetryDelay = WeavyContext.defaults.tokenFactoryRetryDelay;
  tokenFactoryTimeout = WeavyContext.defaults.tokenFactoryTimeout;
  zoomAuthenticationUrl = WeavyContext.defaults.zoomAuthenticationUrl;

  // Promises

  // whenUrl
  #resolveUrl?: (url: URL) => void;

  #whenUrl = new Promise((r) => {
    this.#resolveUrl = r;
  });

  async whenUrl() {
    await this.#whenUrl;
  }

  // whenUrlAndTokenFactory
  #resolveUrlAndTokenFactory?: (value: unknown) => void;

  #whenUrlAndTokenFactory = new Promise((r) => {
    this.#resolveUrlAndTokenFactory = r;
  });

  async whenUrlAndTokenFactory() {
    await this.#whenUrlAndTokenFactory;
  }

  // whenTokenIsValid
  #resolveTokenIsValid?: (value: unknown) => void;

  #whenTokenIsValid = new Promise((r) => {
    this.#resolveTokenIsValid = r;
  });

  async whenTokenIsValid() {
    await this.#whenTokenIsValid;
  }

  // whenConnectionRequested
  #resolveConnectionRequested?: (value: unknown) => void;

  #whenConnectionRequested = new Promise((r) => {
    this.#resolveConnectionRequested = r;
  });

  async whenConnectionRequested() {
    await this.#whenConnectionRequested;
  }

  // Reactive options

  #url?: URL;

  /**
   * The URL to the weavy environment.
   */
  get url() {
    return this.#url;
  }

  set url(url: string | URL | undefined) {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    try {
      if (typeof url === "string") {
        this.#url = toUrl(url);
      } else if (url instanceof URL) {
        this.#url = url;
      } else {
        throw -1;
      }
    } catch (e) {
      throw new Error("Invalid url");
    }

    if (
      !this.disableEnvironmentImports &&
      (globalThis as typeof globalThis & { WEAVY_IMPORT_URL: string }).WEAVY_IMPORT_URL === undefined
    ) {
      (globalThis as typeof globalThis & { WEAVY_IMPORT_URL: string }).WEAVY_IMPORT_URL = new URL(
        "./uikit-web/",
        url
      ).href;
    }

    if (this.#url) {
      this.#resolveUrl?.(this.#url);
    }

    if (this.#url && this.tokenFactory) {
      this.#resolveUrlAndTokenFactory?.(true);
    }
  }

  /**
   * Checks the version of the Weavy Context against the Weavy Environment version.
   *
   * @param {string} [version] - Optional version to check against the environment version.
   */
  async checkVersion(version: string = this.version) {
    await this.whenUrlAndTokenFactory();
    this.networkStateIsPending = true;

    let response;
    try {
      response = await fetch(new URL("/version", this.url), await this.fetchOptions(false));
      if (!response.ok) {
        throw new Error("Could not verify environment version.");
      }
      this.networkStateIsPending = false;
      this.serverState = "ok";
    } catch (e) {
      this.networkStateIsPending = false;
      this.serverState = "unreachable";
      console.warn("Could not check version: " + (e as Error).toString());
      return;
    }

    const environmentVersion = await response.text();

    if (!version || !environmentVersion || version !== environmentVersion) {
      try {
        const semverVersion = version.split(".").slice(0, 2);
        const semverEnvironmentVersion = environmentVersion.split(".").slice(0, 2);

        if (semverVersion[0] !== semverEnvironmentVersion[0]) {
          throw new Error();
        } else if (semverVersion[1] !== semverEnvironmentVersion[1]) {
          console.warn(
            `Version inconsistency: ${WeavyContext.sourceName}@${this.version} ≠ ${
              this.#url?.hostname
            }@${environmentVersion}`
          );
        }
      } catch (e) {
        throw new Error(
          `Version mismatch! ${WeavyContext.sourceName}@${this.version} ≠ ${this.#url?.hostname}@${environmentVersion}`
        );
      }
    }
  }

  // AUTHENTICATION

  #tokenFactory?: WeavyTokenFactory;

  /**
   * Async function returning an `access_token` string for _your_ authenticated user. A boolean `refresh` parameter is provided to let you now if a fresh token is needed from Weavy.
   */
  get tokenFactory() {
    return this.#tokenFactory;
  }

  set tokenFactory(tokenFactory) {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    if (this.#tokenFactory && this.#tokenFactory !== tokenFactory) {
      this.whenUrlAndTokenFactory().then(() => {
        this.queryClient.refetchQueries({ stale: true });
      });
    }

    this.#tokenFactory = tokenFactory;

    if (this.url && this.#tokenFactory) {
      this.#resolveUrlAndTokenFactory?.(true);
    }
  }

  #tokenUrl?: URL;

  /**
   * An URL to an endpoint returning an JSON data containing an `access_token` string property for _your_ authenticated user. A boolean `refresh=true` query parameter is provided in the request to let you now if when a fresh token is needed from Weavy.
   */
  get tokenUrl() {
    return this.#tokenUrl;
  }

  set tokenUrl(tokenUrl: string | URL | undefined) {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    try {
      if (typeof tokenUrl === "string") {
        this.#tokenUrl = toUrl(tokenUrl);
      } else if (tokenUrl instanceof URL) {
        this.#tokenUrl = tokenUrl;
      } else if (tokenUrl !== undefined) {
        throw -1;
      }
    } catch (e) {
      throw new Error("Invalid url");
    }

    if (this.#tokenUrl && !this.tokenFactory) {
      // Set default tokenFactory
      this.tokenFactory = async (refresh) => {
        if (!this.tokenUrl) {
          throw new Error("tokenURL property is not valid");
        }

        const tokenUrl = new URL(this.tokenUrl);

        if (refresh) {
          tokenUrl.searchParams.set("refresh", "true");
        } else {
          tokenUrl.searchParams.delete("refresh");
        }

        const response = await fetch(tokenUrl);

        if (response.ok) {
          const data = await response.json();

          if (data.access_token === undefined) {
            throw new Error("Token response does not contain required property: access_token");
          }

          return data.access_token;
        } else {
          throw new Error("Could not get access token from server!");
        }
      };
    }
  }

  #tokenPromise: Promise<string> | null = null;
  #token: string = "";

  #validateToken(token: unknown) {
    if (!token) {
      return false;
    }

    if (typeof token !== "string") {
      throw new TypeError(`You have provided an invalid string access token of type ${typeof token}.`);
    } else if (typeof token === "string" && !token.startsWith("wyu_")) {
      if (token.startsWith("wys_")) {
        throw new TypeError("You have provided an API key for authentication. Provide a user access token instead.");
      } else {
        throw new TypeError(`You have provided an invalid string as access token.`);
      }
    }

    this.#resolveTokenIsValid?.(token);

    return true;
  }

  #validTokenFromFactory: WeavyTokenFactory = async (refresh: boolean = false) => {
    const racePromises = [this.whenUrlAndTokenFactory()];

    if (this.tokenFactoryRetryDelay !== Infinity) {
      racePromises.push(new Promise((r) => setTimeout(r, this.tokenFactoryRetryDelay)));
    }

    await Promise.race(racePromises);

    const token = await this.tokenFactory?.(refresh);

    if (!this.#validateToken(token)) {
      // Reset token promise and wait for a more valid token
      this.#whenUrlAndTokenFactory = new Promise((r) => {
        this.#resolveUrlAndTokenFactory = r;
      });

      if (!refresh) {
        return await this.#validTokenFromFactory(false);
      }
    }

    if (!token) {
      throw new TypeError("Could not get a valid token from tokenFactory.");
    }

    this.#resolveUrlAndTokenFactory?.(true);

    return token;
  };

  async getToken(refresh: boolean = false): Promise<string> {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    if (this.#token && !refresh) {
      return this.#token;
    }

    await this.whenUrlAndTokenFactory();

    if (!this.#tokenPromise) {
      this.#tokenPromise = new Promise((resolve, reject) => {
        // Try getting a valid token
        this.#validTokenFromFactory(refresh).then(resolve).catch(reject);

        if (this.tokenFactoryTimeout !== Infinity) {
          setTimeout(() => reject(new Error("Token factory timeout.")), this.tokenFactoryTimeout);
        }

        window.addEventListener("offline", () => reject(new Error("Network changed.")), { once: true });
        window.addEventListener("online", () => reject(new Error("Network changed.")), { once: true });
      });
      try {
        const token = await this.#tokenPromise;

        this.#tokenPromise = null;
        this.#token = token;
        return this.#token;
      } catch (e) {
        this.#tokenPromise = null;
        console.error(e);
        throw e;
      }
    } else {
      //console.log(this.weavyId, "Already a promise in action, wait for it to resolve...")
      return await this.#tokenPromise;
    }
  }

  // QUERY CLIENT

  #queryClient!: QueryClient;
  #unsubscribeQueryClient?: () => void;
  #sessionStoragePersister?: Persister;

  get queryClient() {
    return this.#queryClient;
  }

  private async createQueryClient() {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    this.#queryClient = new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: this.staleTime,
          gcTime: this.gcTime,
        },
      },
    });

    //const localStoragePersister = createSyncStoragePersister({ storage: window.localStorage })
    try {
      this.#sessionStoragePersister = createSyncStoragePersister({
        key: "WEAVY_QUERY_OFFLINE_CACHE",
        storage: window.sessionStorage,
        throttleTime: this.staleTime,
      });

      // TODO: Move to "modern" persistQueryClient?
      const persistQueryClientOptions = {
        queryClient: this.#queryClient,
        persister: this.#sessionStoragePersister,
        maxAge: this.gcTime, // 24h - should match gcTime
        buster: WeavyContext.version, // Cache busting parameter (build hash or similar)
        hydrateOptions: undefined,
        dehydrateOptions: {
          shouldDehydrateMutation: (mutation: Mutation) => {
            const isPendingUpload = (mutation.state.context as FileMutationContextType)?.status?.state === "pending";
            return Boolean((mutation.state.context && !isPendingUpload) || mutation.state.isPaused);
          },
        },
      };

      await persistQueryClientRestore(persistQueryClientOptions);
      this.#unsubscribeQueryClient = persistQueryClientSubscribe(persistQueryClientOptions);
    } catch (e) {
      console.warn(this.weavyId, "Query cache persister not available.");
    }

    //console.log(this.weavyId, "Query cache restored from session", this.#queryClient.getMutationCache())
  }

  private async disconnectQueryClient() {
    console.log(this.weavyId, "Query client disconnected");
    await this.#queryClient.cancelQueries();
    this.queryClient.setQueriesData({}, undefined);
    this.queryClient.resetQueries();
    this.#sessionStoragePersister?.removeClient();
    this.#unsubscribeQueryClient?.();
    this.#queryClient.unmount();
    this.#queryClient.clear();
  }

  // RTM CONNECTION

  #connection?: HubConnection;
  #connectionEventListeners: Array<{ name: string; callback: Function }> = [];

  private signalRAccessTokenRefresh = false;

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
    return await this.#whenConnectionStarted;
  }

  private async createConnection() {
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

  async disconnect() {
    if (this.#connection) {
      await this.#connection.stop();
      this.connectionState = "disconnected";
    }
  }

  async connect() {
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
          ? this.#connectionState === "connected" ||
            this.#serverState === "ok"
            ? "online"
            : "unreachable"
          : "offline",
      isPending: this.#networkStateIsPending,
    };
  }

  private triggerNetworkChange() {
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

  // MODALS

  #modalPortal?: WeavyPortal;

  // LOCALIZATION

  //#locales = WeavyContext.defaults.locales;

  #locales: Map<string, LocaleModule | Promise<LocaleModule> | (() => Promise<LocaleModule>)> = new Map([
    ["sv-SE", () => import("../../locales/sv-SE")],
  ]);

  get locales() {
    return Array.from(this.#locales.entries());
  }

  set locales(locales) {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    if (this.localization) {
      throw new Error("Locales may only be configured once");
    }

    if (!Array.isArray(locales)) {
      throw new TypeError("Provided locales have invalid format.");
    }

    locales.forEach((locale) => {
      if (!Array.isArray(locale) || locale.length !== 2 || typeof locale[0] !== "string") {
        throw new TypeError("Invalid locale provided: " + locale[0]);
      }
      this.#locales.set(...locale);
    });
    this.configureLocalization();
  }

  #locale = WeavyContext.sourceLocale;
  localization?: ReturnType<typeof configureLocalization>;

  /**
   * Selected locale. The locale must be pre configured in `.locales`.
   */
  get locale() {
    return this.#locale;
  }

  set locale(newLocale) {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    if (!this.locale && !newLocale) {
      return;
    }

    this.#locale = newLocale;
    if (this.localization) {
      this.localization.setLocale(this.locale);
    } else {
      queueMicrotask(() => {
        if (this.localization) {
          this.localization.setLocale(this.locale);
        } else if (this.locale !== WeavyContext.sourceLocale) {
          if (this.#locales.has(this.locale)) {
            this.configureLocalization();
          }
          if (this.localization) {
            (this.localization as ReturnType<typeof configureLocalization>).setLocale(this.locale);
          } else {
            console.error(this.weavyId, `You need to configure additional languages in config to use '${newLocale}'.`);
          }
        }
      });
    }
  }

  async loadLocale(newLocale: string) {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    if (this.#locales?.has(newLocale)) {
      const localizedTemplate = this.#locales.get(newLocale);
      console.log(
        this.weavyId,
        typeof localizedTemplate === "function" ? "loading locale" : "preloaded locale",
        newLocale
      );
      return await ((typeof localizedTemplate === "function"
        ? localizedTemplate()
        : localizedTemplate) as Promise<LocaleModule>);
    } else {
      throw new Error("The requested locale is not configured");
    }
  }

  configureLocalization() {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    if (this.#locales?.size) {
      if (!this.localization) {
        const targetLocales = this.#locales.keys();
        console.log(this.weavyId, "Configuring locales", targetLocales);

        const { getLocale, setLocale } = configureLocalization({
          sourceLocale: WeavyContext.sourceLocale,
          targetLocales,
          loadLocale: (newLocale) => this.loadLocale(newLocale),
        });

        this.localization = {
          getLocale,
          setLocale,
        };
      }
    }
  }

  // CONSTRUCTOR

  constructor(
    options?: WeavyOptions & {
      /**
       * The host where the Weavy context is provided.
       */
      host?: HTMLElement;
    }
  ) {
    console.info(`${WeavyContext.sourceName}@${WeavyContext.version} #${this.weavySid}`);

    const validOptions: typeof options = {};

    for (const option in options) {
      // Check for valid properties
      const optionKey = option as keyof typeof options;
      if (options[optionKey] !== undefined) {
        Object.assign(validOptions, { [optionKey]: options[optionKey] });
      }
    }

    if (validOptions?.host) {
      this.host = validOptions.host;
      delete validOptions.host;
    }

    if (validOptions) {
      Object.assign(this, validOptions);
    }

    this.createQueryClient();

    this.whenConnectionRequested().then(() => {
      if (!this.isDestroyed) {
        //console.log(this.weavyId, "Weavy url and tokenFactory configured.");
        this.createConnection();
      }
    });

    this.whenUrlAndTokenFactory().then(() => {
      if (!this.isDestroyed) {
        this.checkVersion();
      }
    });

    // Context root

    if (this.host !== document.documentElement) {
      globalContextProvider.detachListeners();
      this.#hostContextProvider = new ContextProvider(this.host, {
        context: weavyContextDefinition,
        initialValue: this,
      });
    } else {
      globalContextProvider.setValue(this);
    }

    if (this.host.isConnected) {
      this.#queryClient.mount();
    }

    this.#hostIsConnectedObserver = observeConnected(this.host, (isConnected) => {
      if (this.isDestroyed) {
        return;
      }

      if (isConnected) {
        console.log(this.weavyId, "Query client mounted");
        this.#queryClient.mount();
      } else {
        console.log(this.weavyId, "Query client unmounted");
        this.#queryClient.unmount();
      }
    });

    adoptGlobalStyles([colorModes]);

    // Root node for modal portal

    defer(async () => {
      if (this.isDestroyed) {
        return;
      }

      if (modalController.host && modalController.host instanceof WeavyPortal) {
        this.#modalPortal = modalController.host as WeavyPortal;
      } else {
        this.#modalPortal = new WeavyPortal();
      }

      this.#modalPortal.connectedContexts.add(this);

      if (document) {
        const modalRoot: HTMLElement =
          (this.modalParent && document.querySelector(this.modalParent)) || document.documentElement;

        if (!modalRoot.contains(this.#modalPortal)) {
          modalRoot.append(this.#modalPortal);
          if (!this.host.contains(modalRoot)) {
            // Make the modal root a provider as well if needed
            this.#modalContextProvider = new ContextProvider(modalRoot, {
              context: weavyContextDefinition,
              initialValue: this,
            });
          }
        }
      }
    });

    window.addEventListener("online", () => {
      this.networkState = "online";
    });

    window.addEventListener("offline", () => {
      this.networkState = "offline";
      this.networkStateIsPending = false;
    });
  }

  // FETCH

  async fetchOptions(authorized: boolean = true): Promise<RequestInit> {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    const headers: PlainObjectType = {
      "X-Weavy-Source": `${WeavyContext.sourceName}@${WeavyContext.version}`,
    };

    if (authorized) {
      headers.Authorization = "Bearer " + (await this.getToken());
    }

    return assign(
      defaultFetchSettings,
      {
        headers,
      },
      true
    );
  }

  async get(url: string): Promise<Response> {
    return await this.post(url, "GET");
  }

  async post(
    url: string,
    method: HttpMethodType,
    body?: BodyInit,
    contentType: HeaderContentType = HeaderContentType.JSON,
    retry: boolean = true
  ): Promise<Response> {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    const fetchOptions: RequestInit = assign(
      await this.fetchOptions(),
      {
        headers: { "content-type": contentType },
        method: method,
        body: body,
      },
      true
    );

    this.networkStateIsPending = true;
    const response = await fetch(new URL(url, this.url), fetchOptions);

    if (!response.ok) {
      if (response.status === 401 || response.status === 403) {
        if (retry) {
          await this.getToken(true);
          return await this.post(url, method, body, contentType, false);
        } else {
          this.networkStateIsPending = false;
          this.serverState = "unauthorized";
        }
      } else {
        this.networkStateIsPending = false;
        this.serverState = "unreachable";
      }

      //console.error(this.weavyId, `Error calling endpoint ${url}`, response)
    } else {
      this.networkStateIsPending = false;
      this.serverState = "ok";
    }

    return response;
  }

  async upload(
    url: string,
    method: HttpUploadMethodType,
    body: string | FormData,
    contentType: HeaderContentType = HeaderContentType.JSON,
    onProgress?: (progress: number) => void,
    retry: boolean = true
  ) {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    const token = await this.getToken();

    return await new Promise<Response>((resolve, reject) => {
      // XMLHttpRequest instead of fetch because we want to track progress
      const xhr = new XMLHttpRequest();
      xhr.open(method, new URL(url, this.url), true);
      xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.setRequestHeader("X-Weavy-Source", `${WeavyContext.sourceName}@${WeavyContext.version}`);
      if (contentType) {
        xhr.setRequestHeader("content-type", contentType);
      }
      if (onProgress) {
        xhr.upload.addEventListener("progress", (e: ProgressEvent<EventTarget>) => {
          onProgress((e.loaded / e.total) * 100 || 100);
        });
      }

      xhr.onload = (_evt: ProgressEvent<EventTarget>) => {
        if (retry && (xhr.status === 401 || xhr.status === 401)) {
          this.getToken(true)
            .then(() => this.upload(url, method, body, contentType, onProgress, false))
            .then(resolve)
            .catch(reject);
        } else {
          resolve(new Response(xhr.response, { status: xhr.status, statusText: xhr.statusText }));
        }
      };
      xhr.onerror = reject;
      xhr.send(body);
    });
  }

  destroy() {
    this.#isDestroyed = true;

    this.#hostIsConnectedObserver.disconnect();

    this.disconnectQueryClient();
    this.disconnect();

    if (this.#whenConnectionStartedReject) {
      // add default catch
      this.#whenConnectionStarted.catch(() => {});
      this.#whenConnectionStartedReject(new DestroyError());
    }

    this.#hostContextProvider?.detachListeners();
    this.#modalContextProvider?.detachListeners();

    if (this.#modalPortal) {
      this.#modalPortal.connectedContexts.delete(this);
      if (!this.#modalPortal.connectedContexts.size) {
        this.#modalPortal?.remove();
      }
    }

    console.info(this.weavyId, "was destroyed");
  }
}

export const Weavy = WeavyContext;
