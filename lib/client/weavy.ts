import { S4 } from "../utils/data";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { globalContextProvider, WeavyContext } from "../contexts/weavy-context";
import { chrome } from "../utils/browser";
import { DestroyError } from "../utils/errors";
import { throwOnDomNotAvailable } from "../utils/dom";
import type { WeavyOptions, Destructable, WeavyClientOptionsType } from "../types/weavy.types";
import { SOURCE_LOCALE, WeavyLocalizationMixin, WeavyLocalizationProps } from "./localization";
import { WeavyNetworkMixin, WeavyNetworkProps } from "./network";
import { WeavyAuthenticationMixin, WeavyAuthenticationProps } from "./authentication";
import { WeavyConnectionMixin, WeavyConnectionProps } from "./connection";
import { WeavyQueryMixin, WeavyQueryProps } from "./query";
import { WeavyVersionMixin, WeavyVersionProps } from "./version";
import { WeavyFetchMixin, WeavyFetchProps } from "./fetch";
import { WeavyStylesMixin, WeavyStylesProps } from "./styles";
import { WeavyRealtimeMixin, WeavyRealtimeProps, type WyNotificationsEventType } from "./realtime";
import { WeavyApiMixin, WeavyApiProps, type AppType } from "./api";

export type { WeavyOptions, Destructable, WeavyClientOptionsType };

export type WeavyType = WeavyClient &
  WeavyNetworkProps &
  WeavyAuthenticationProps &
  WeavyLocalizationProps &
  WeavyConnectionProps &
  WeavyQueryProps &
  WeavyVersionProps &
  WeavyFetchProps &
  WeavyStylesProps &
  WeavyRealtimeProps &
  WeavyApiProps;

/**
 * Context for Weavy that handles communication with the server, data handling and common options.
 * Requires a `url` to the Weavy environment and an async `tokenFactory` that provides user access tokens.
 */
export class WeavyClient implements WeavyOptions, Destructable {
  /**
   * The semver version of the package.
   */
  static readonly version = WEAVY_VERSION ?? "";

  /**
   * The Weavy source name; package name.
   */
  static readonly sourceName = WEAVY_SOURCE_NAME ?? "Weavy";

  // CONFIG

  static defaults: WeavyOptions = {
    cloudFilePickerUrl: "https://filebrowser.weavy.io/v14/",
    confluenceAuthenticationUrl: undefined,
    confluenceProductName: undefined,
    disableEnvironmentImports: false,
    gcTime: 1000 * 60 * 60 * 24, // 24h,
    locale: SOURCE_LOCALE,
    reactions: ["😍", "😎", "😉", "😜", "👍"],
    notificationEvents: false,
    scrollBehavior: chrome ? "instant" : "smooth",
    staleTime: 1000 * 1, // 1s
    tokenFactoryRetryDelay: 2000,
    tokenFactoryTimeout: 20000,
  };

  readonly weavySid: string = S4();
  readonly weavyId: string = `${WeavyClient.sourceName}#${this.weavySid}`;

  /**
   * The host where the Weavy context is provided.
   */
  readonly host: HTMLElement;

  #hostContextProvider?: ContextProvider<typeof WeavyContext>;

  // OPTIONS

  cloudFilePickerUrl = WeavyClient.defaults.cloudFilePickerUrl;
  confluenceAuthenticationUrl = WeavyClient.defaults.confluenceAuthenticationUrl;
  confluenceProductName = WeavyClient.defaults.confluenceProductName;
  disableEnvironmentImports = WeavyClient.defaults.disableEnvironmentImports;
  gcTime = WeavyClient.defaults.gcTime;
  reactions = WeavyClient.defaults.reactions;
  scrollBehavior = WeavyClient.defaults.scrollBehavior;
  staleTime = WeavyClient.defaults.staleTime;
  tokenFactoryRetryDelay = WeavyClient.defaults.tokenFactoryRetryDelay;
  tokenFactoryTimeout = WeavyClient.defaults.tokenFactoryTimeout;

  // Promises

  // whenUrl
  #resolveUrl?: (url: URL) => void;

  #whenUrl = new Promise((r) => {
    this.#resolveUrl = r;
  });

  async whenUrl() {
    await this.#whenUrl;
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
        if (url) {
          this.#url = new URL(url, window.location.toString());
        }
      } else if (url instanceof URL) {
        this.#url = url;
      } else {
        throw -1;
      }
    } catch {
      throw new TypeError("Invalid url");
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
  }

  // CONSTRUCTOR

  constructor(options?: WeavyClientOptionsType) {
    console.info(`${WeavyClient.sourceName}@${WeavyClient.version} #${this.weavySid}`);

    throwOnDomNotAvailable();

    this.host = document.documentElement;

    const validOptions: typeof options = {};

    // constructor options
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

    // Context root
    if (this.host !== document.documentElement) {
      globalContextProvider?.detachListeners();
      this.#hostContextProvider = new ContextProvider(this.host, {
        context: WeavyContext,
        initialValue: this as unknown as Weavy,
      });
    } else {
      globalContextProvider?.setValue(this as unknown as Weavy);
    }
  }

  #isDestroyed = false;

  get isDestroyed() {
    return this.#isDestroyed;
  }

  destroy() {
    this.#isDestroyed = true;
    this.#hostContextProvider?.detachListeners();
    console.info(this.weavyId, "was destroyed");
  }
}

export class Weavy
  extends WeavyApiMixin(
    WeavyRealtimeMixin(
      WeavyLocalizationMixin(
        WeavyConnectionMixin(
          WeavyNetworkMixin(
            WeavyAuthenticationMixin(WeavyQueryMixin(WeavyVersionMixin(WeavyFetchMixin(WeavyStylesMixin(WeavyClient)))))
          )
        )
      )
    )
  )
  implements WeavyType {}

export type { WyNotificationsEventType, AppType };
