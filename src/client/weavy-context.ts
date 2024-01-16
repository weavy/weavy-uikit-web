import { LocaleModule, configureLocalization } from "@lit/localize";
import { QueryClient, type Mutation } from "@tanstack/query-core";
import { HubConnectionBuilder, HubConnection, LogLevel } from "@microsoft/signalr";
import { WeavyTokenFactory, WeavyOptions } from "../types/weavy.types";
import WeavyPortal from "../components/wy-portal";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { persistQueryClientRestore, persistQueryClientSubscribe } from "@tanstack/query-persist-client-core";
import { FileMutationContextType } from "../types/files.types";

import { assign } from "../utils/objects";
import { defaultFetchSettings } from "../utils/data";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { globalContextProvider, weavyContextDefinition } from "./context-definition";
import { defer, observeConnected } from "../utils/dom";
import { chrome } from "../utils/browser";
import { RealtimeDataType, RealtimeEventType } from "../types/realtime.types";
import { ConnectionState, NetworkState, NetworkStatus } from "../types/server.types";

import colorModes from "../scss/colormodes.scss";
import { adoptGlobalStyles } from "../utils/styles";

/**
 * The locale used in the source files.
 */
const SOURCE_LOCALE = "en";

/**
 * Context for Weavy that handles communication with the server, data handling and common options.
 * Requires a `url` to the Weavy environment and an async `tokenFactory` that provides user access tokens.
 */
export class WeavyContext implements WeavyOptions {
  /**
   * The semver version of the package.
   */
  static readonly version: string = WEAVY_VERSION;

  /**
   * The Weavy source name; package name and version.
   */
  static readonly sourceName: string = WEAVY_SOURCE_NAME;

  /**
   * The locale used in the Weavy source.
   */
  static readonly sourceLocale = SOURCE_LOCALE;

  // CONFIG

  static defaults: WeavyOptions = {
    zoomAuthenticationUrl: undefined,
    cloudFilePickerUrl: "https://filebrowser.weavy.io/v14/",
    reactions: ["😍", "😎", "😉", "😜", "👍"],
    locale: SOURCE_LOCALE,
    locales: [],
    localesUrl: "./locales",
    staleTime: 1000 * 1, // 1s
    gcTime: 1000 * 60 * 60 * 24, // 24h,
    tokenFactoryTimeout: 20000,
    modalParent: "body",
    scrollBehavior: chrome ? "instant" : "smooth",
  };

  /**
   * The host where the Weavy context is provided.
   */
  readonly host: HTMLElement = document.documentElement;

  // OPTIONS

  zoomAuthenticationUrl = WeavyContext.defaults.zoomAuthenticationUrl;
  cloudFilePickerUrl = WeavyContext.defaults.cloudFilePickerUrl;
  reactions = WeavyContext.defaults.reactions;
  staleTime = WeavyContext.defaults.staleTime;
  gcTime = WeavyContext.defaults.gcTime;
  tokenFactoryTimeout = WeavyContext.defaults.tokenFactoryTimeout;
  modalParent = WeavyContext.defaults.modalParent;
  scrollBehavior = WeavyContext.defaults.scrollBehavior;

  // Reactive options
  #locales = WeavyContext.defaults.locales;

  get locales() {
    return this.#locales;
  }

  set locales(locales) {
    if (locales?.length !== this.#locales?.length && this.localization) {
      throw new Error("Locales may only be configured once");
    }
    this.#locales = locales;
    this.configureLocalization();
  }

  #localesUrl = WeavyContext.defaults.localesUrl;

  get localesUrl() {
    return this.#localesUrl;
  }

  set localesUrl(localesUrl) {
    this.#localesUrl = localesUrl;
    this.configureLocalization();
  }

  #resolveUrlAndTokenFactory?: (value: unknown) => void;

  #whenUrlAndTokenFactory = new Promise((r) => {
    this.#resolveUrlAndTokenFactory = r;
  });

  async whenUrlAndTokenFactory() {
    await this.#whenUrlAndTokenFactory;
  }

  #url?: URL;

  /**
   * The URL to the weavy environment.
   */
  get url() {
    return this.#url;
  }

  set url(url: string | URL | undefined) {
    try {
      if (typeof url === "string") {
        this.#url = new URL(url);
      } else if (url instanceof URL) {
        this.#url = url;
      } else {
        throw -1;
      }
    } catch (e) {
      throw new Error("Invalid url");
    }

    if (this.tokenFactory) {
      this.#resolveUrlAndTokenFactory?.(true);
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
    this.#tokenFactory = tokenFactory;

    if (this.url) {
      this.#resolveUrlAndTokenFactory?.(true);
    }
  }

  #tokenPromise: Promise<string> | null = null;
  #token: string = "";

  async getToken(refresh: boolean = false): Promise<string> {
    if (this.#token && !refresh) return this.#token;

    await this.whenUrlAndTokenFactory();

    if (!this.#tokenPromise) {
      this.#tokenPromise = new Promise((resolve, reject) => {
        this.tokenFactory?.(refresh).then(resolve).catch(reject);
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
        throw e;
      }
    } else {
      //console.log("Already a promise in action, wait for it to resolve...")
      return this.#tokenPromise;
    }
  }

  // QUERY CLIENT

  #queryClient!: QueryClient;
  #unsubscribeQueryClient?: () => void;

  get queryClient() {
    return this.#queryClient;
  }

  private async createQueryClient() {
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
      const sessionStoragePersister = createSyncStoragePersister({
        key: "WEAVY_QUERY_OFFLINE_CACHE",
        storage: window.sessionStorage,
        throttleTime: this.staleTime,
      });

      // TODO: Move to "modern" persistQueryClient?
      const persistQueryClientOptions = {
        queryClient: this.#queryClient,
        persister: sessionStoragePersister,
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
      console.warn("Query cache persister not available.");
    }

    //console.log("Query cache restored from session", this.#queryClient.getMutationCache())
  }

  private async disconnectQueryClient() {
    this.#unsubscribeQueryClient?.();
    await this.#queryClient.cancelQueries();
    this.#queryClient.unmount();
    this.#queryClient.clear();
  }

  // RTM CONNECTION

  #connection?: HubConnection;
  #connectionEventListeners: Array<{ name: string; callback: Function }> = [];

  private signalRAccessTokenRefresh = false;

  #whenConnectionStartedResolve?: (value: unknown) => void;
  #whenConnectionStarted = new Promise((r) => (this.#whenConnectionStartedResolve = r));

  get rtmConnection() {
    return this.#connection;
  }

  async whenConnectionStarted() {
    return await this.#whenConnectionStarted;
  }

  private async createConnection() {
    if (this.url && this.tokenFactory) {
      this.networkStateIsPending = true;

      if (this.#connection) {
        const connectionUrl = new URL("/hubs/rtm", this.url);
        if (this.#connection.baseUrl !== connectionUrl.toString()) {
          this.connectionState = "reconnecting";
          console.log("Reconnecting due to changed url.", this.#connection.baseUrl, "=>", connectionUrl.toString());
          await this.disconnect();
          this.#connection.baseUrl = connectionUrl.toString();
          this.connect();
        }
      } else {
        this.connectionState = "connecting";
        //console.log("Creating connection");
        const connectionUrl = new URL("/hubs/rtm", this.url);
        this.#connection = new HubConnectionBuilder()
          .configureLogging(LogLevel.None)
          .withUrl(connectionUrl.toString(), {
            accessTokenFactory: async () => {
              if (this.signalRAccessTokenRefresh) {
                //console.error("SignalR retrying with refreshed token.");
                const token = await this.getToken(true);
                this.signalRAccessTokenRefresh = false;
                return token;
              } else {
                //console.error("first attempt")
                const token = await this.getToken();
                return token;
              }
            },
          })
          .withAutomaticReconnect({
            nextRetryDelayInMilliseconds: (retryContext) => {
              if (window.navigator.onLine && document?.visibilityState !== "hidden") {
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
          console.info("SignalR closed.");
          this.connectionState = "disconnected";
          this.networkStateIsPending = true;
          this.#whenConnectionStarted = new Promise((r) => (this.#whenConnectionStartedResolve = r));
          this.connect();
        });
        this.#connection.onreconnecting((_error) => {
          console.log("SignalR reconnecting...");
          this.connectionState = "reconnecting";
          //this.networkStateIsPending = true;
        });
        this.#connection.onreconnected((_connectionId) => {
          console.info("SignalR reconnected.");
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
    if (this.#connection) {
      console.log("Connecting SignalR...");
      //this.networkStateIsPending = true;

      try {
        if (!window.navigator.onLine) {
          throw new Error();
        }
        await this.#connection.start();
        this.signalRAccessTokenRefresh = false;
        this.networkStateIsPending = false;
        this.connectionState = "connected";
        this.#whenConnectionStartedResolve?.(undefined);
        console.info("SignalR connected.");
      } catch (e: unknown) {
        if (!window.navigator.onLine) {
          this.networkStateIsPending = false;
          console.log("Offline, reconnecting SignalR when online.");
          await new Promise((r) => {
            window.addEventListener("online", r, { once: true });
          });
        } else {
          if (
            !this.signalRAccessTokenRefresh &&
            window.document.visibilityState !== "hidden" &&
            (e as Error).toString().includes("Unauthorized")
          ) {
            console.log("Retrying SignalR connect with fresh token.");
            this.signalRAccessTokenRefresh = true;
          } else {
            console.log(
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
    try {
      if (!this.#connection) {
        throw new Error("Connection not created");
      }

      const name = group ? group + ":" + event : event;

      if (this.#connectionEventListeners.some((el) => el.name === name && el.callback === callback)) {
        throw new Error("Duplicate subscribe: " + name);
      }

      this.#connectionEventListeners.push({ name, callback });
      this.#connection.on(name, callback);

      //console.log("Subscribing", name);
      await this.whenConnectionStarted();
      await this.#connection.invoke("Subscribe", name);
    } catch (err: unknown) {
      console.error("Error in Subscribe:", err);
    }
  }

  async unsubscribe<T extends RealtimeEventType | RealtimeDataType>(
    group: string | null,
    event: string,
    callback: (realTimeEvent: T) => void
  ) {
    try {
      if (!this.#connection) {
        throw new Error("Connection not created");
      }
      
      const name = group ? group + ":" + event : event;

      // get first occurrence of group name and remove it
      const index = this.#connectionEventListeners.findIndex((el) => el.name === name && el.callback === callback);
      if (index !== -1) {
        this.#connectionEventListeners.splice(index, 1);

        this.#connection?.off(name, callback);

        // if no more groups, remove from server
        if (!this.#connectionEventListeners.some((el) => el.name === name)) {
          await this.whenConnectionStarted();
          await this.#connection.invoke("Unsubscribe", name);
        }
      }
    } catch (err: unknown) {
      console.warn("Error in Unsubscribe:", err);
    }
  }

  // NETWORK

  #networkEvents = new Set<(status: NetworkStatus) => void>();
  #connectionState: ConnectionState = "connecting";
  #networkState: NetworkState = window.navigator.onLine ? "online" : "offline";
  #networkStateIsPending: boolean = false;

  get networkState() {
    return this.#networkState;
  }

  set networkState(state: NetworkState) {
    this.#networkState = state;
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
          ? this.#connectionState === "connected" || this.#connectionState === "connecting"
            ? "online"
            : "unreachable"
          : "offline",
      isPending: this.#networkStateIsPending,
    };
  }

  private triggerNetworkChange() {
    const networkStatus = this.network;
    //console.log("network status changed", networkStatus);
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

  #modalPortal = new WeavyPortal();

  // LOCALIZATION

  #locale = WeavyContext.sourceLocale;
  localization?: ReturnType<typeof configureLocalization>;

  /**
   * Selected locale. The locale must be pre configured in `.locales`.
   */
  get locale() {
    return this.#locale;
  }

  set locale(newLocale) {
    this.#locale = newLocale;
    if (this.localization) {
      this.localization.setLocale(this.locale);
    } else {
      queueMicrotask(() => {
        if (this.localization) {
          this.localization.setLocale(this.locale);
        } else if (this.locale !== WeavyContext.sourceLocale) {
          console.error(`You need to configure additional languages in config to use '${newLocale}'.`);
        }
      });
    }
  }

  localizedTemplates?: Map<string, LocaleModule | Promise<LocaleModule>> = new Map();

  async loadLocale(newLocale: string) {
    if (this.localizedTemplates?.has(newLocale)) {
      console.log("preloaded locale", newLocale);
      return await (this.localizedTemplates.get(newLocale) as Promise<LocaleModule>);
    } else {
      console.log("load locale", newLocale);
      const localePath = new URL(`${this.localesUrl}/${newLocale}.js`, window.location.href);
      return await (import(localePath.toString()) as Promise<LocaleModule>);
    }
  }

  configureLocalization() {
    if (this.locales?.length) {
      if (!this.localization) {
        const targetLocales = this.locales;
        console.log("Configuring locales", targetLocales);

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
    console.info(`${WeavyContext.sourceName}@${WeavyContext.version}`);

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

    this.whenUrlAndTokenFactory().then(() => {
      console.log("Weavy url and tokenFactory configured.");
      this.createConnection();
    });

    // Root node for modal portal

    if (this.host !== document.documentElement) {
      globalContextProvider.detachListeners();
      new ContextProvider(this.host, { context: weavyContextDefinition, initialValue: this });
    } else {
      globalContextProvider.setValue(this);
    }

    if (this.host.isConnected) {
      this.#queryClient.mount();
    }

    observeConnected(this.host, (isConnected) => {
      if (isConnected) {
        console.log("Query client mounted");
        this.#queryClient.mount();
      } else {
        this.#queryClient.unmount();
      }
    });

    adoptGlobalStyles([colorModes]);

    defer(() => {
      if (document) {
        const modalRoot: HTMLElement =
          (this.modalParent && document.querySelector(this.modalParent)) || document.documentElement;
        modalRoot.append(this.#modalPortal);
        if (!this.host.contains(modalRoot)) {
          // Make the modal root a provider as well if needed
          new ContextProvider(modalRoot, { context: weavyContextDefinition, initialValue: this });
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

  async fetchOptions(): Promise<RequestInit> {
    return assign(
      defaultFetchSettings,
      {
        headers: {
          Authorization: "Bearer " + (await this.getToken()),
          "X-Weavy-Source": `${WeavyContext.sourceName}@${WeavyContext.version}`,
        },
      },
      true
    );
  }

  async get(
    url: string,
    contentType: string = "application/json;charset=utf-8",
    retry: boolean = true
  ): Promise<Response> {
    const fetchOptions = assign(
      await this.fetchOptions(),
      {
        headers: { "content-type": contentType },
      },
      true
    );

    const response = await fetch(new URL(url, this.url), fetchOptions);

    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && retry) {
        await this.getToken(true);
        return await this.get(url, contentType, false);
      }

      //console.error(`Error calling endpoint ${url}`, response)
    }

    return response;
  }

  async post(
    url: string,
    method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH",
    body: string | FormData,
    contentType: string = "application/json;charset=utf-8",
    retry: boolean = true
  ): Promise<Response> {
    const fetchOptions = assign(
      await this.fetchOptions(),
      {
        headers: { "content-type": contentType },
        method: method,
        body: body,
      },
      true
    );

    const response = await fetch(new URL(url, this.url), fetchOptions);

    if (!response.ok) {
      if ((response.status === 401 || response.status === 403) && retry) {
        await this.getToken(true);
        return await this.post(url, method, body, contentType, false);
      }

      //console.error(`Error calling endpoint ${url}`, response)
    }

    return response;
  }

  async upload(
    url: string,
    method: "POST" | "PUT" | "PATCH",
    body: string | FormData,
    contentType: string = "application/json;charset=utf-8",
    onProgress?: (progress: number) => void,
    retry: boolean = true
  ) {
    const token = await this.getToken();

    return await new Promise<Response>((resolve, reject) => {
      // XMLHttpRequest instead of fetch because we want to track progress
      const xhr = new XMLHttpRequest();
      xhr.open(method, new URL(url, this.url), true);
      xhr.setRequestHeader("Authorization", "Bearer " + token);
      xhr.setRequestHeader("X-Weavy-Source", `${WeavyContext.sourceName}@${WeavyContext.version}`);
      if (contentType !== "") {
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
    this.disconnect();
    this.disconnectQueryClient();
  }
}
