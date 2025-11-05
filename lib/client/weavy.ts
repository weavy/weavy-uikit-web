import { S4 } from "../utils/data";
import { DestroyError } from "../utils/errors";
import { throwOnDomNotAvailable } from "../utils/dom";
import type {
  WeavyOptions,
  Destructable,
  WeavyClientOptionsType,
  WeavyTokenFactory,
  StrictWeavyOptions,
  Resettable,
} from "../types/weavy.types";
import { WeavyApiMixin, WeavyApiProps, type AppType } from "./api";
import { WeavyAuthenticationMixin, WeavyAuthenticationProps } from "./authentication";
import { WeavyConnectionMixin, WeavyConnectionProps } from "./connection";
import { WeavyFetchMixin, WeavyFetchProps } from "./fetch";
import { SOURCE_LOCALE, WeavyLocalizationMixin, WeavyLocalizationProps } from "./localization";
import { WeavyNetworkMixin, WeavyNetworkProps } from "./network";
import { WeavyQueryMixin, WeavyQueryProps } from "./query";
import { WeavyRealtimeMixin, WeavyRealtimeProps, type WyNotificationsEventType } from "./realtime";
import { WeavySettingsMixin, WeavySettingsProps } from "./settings";
import { WeavyStylesMixin, WeavyStylesProps } from "./styles";
import { WeavyVersionMixin, WeavyVersionProps } from "./version";
import { WeavyContextProviderMixin, WeavyContextProviderProps } from "./context";
import { WeavyComponentSettingProps } from "../classes/weavy-component";

export type { WeavyOptions, Destructable, WeavyClientOptionsType, WeavyTokenFactory, StrictWeavyOptions };
export type * from "./api";
export type * from "./authentication";
export type * from "./connection";
export type * from "./fetch";
export type * from "./localization";
export type * from "./network";
export type * from "./query";
export type * from "./realtime";
export type * from "./settings";
export type * from "./styles";
export type * from "./version";

/**
 * Context for Weavy that handles communication with the server, data handling and common options.
 * Requires a `url` to the Weavy environment and an async `tokenFactory` that provides user access tokens.
 *
 * @fires wy-notifications {WyNotificationsEventType}
 */
export type WeavyType = WeavyClient &
  StrictWeavyOptions &
  WeavySettingsProps &
  WeavyNetworkProps &
  WeavyAuthenticationProps &
  WeavyLocalizationProps &
  WeavyConnectionProps &
  WeavyQueryProps &
  WeavyVersionProps &
  WeavyFetchProps &
  WeavyStylesProps &
  WeavyRealtimeProps &
  WeavyApiProps &
  WeavyContextProviderProps;

/**
 * Context for Weavy that handles communication with the server, data handling and common options.
 * Requires a `url` to the Weavy environment and an async `tokenFactory` that provides user access tokens.
 *
 * @fires wy-notifications {WyNotificationsEventType}
 */
export class WeavyClient implements WeavyOptions, Resettable, Destructable {
  /**
   * The semver version of the package.
   */
  static readonly version = WEAVY_VERSION ?? "";

  /**
   * The Weavy source name; package name.
   */
  static readonly sourceName = WEAVY_SOURCE_NAME ?? "Weavy";

  // CONFIG

  static defaults: StrictWeavyOptions & WeavyComponentSettingProps = {
    // StrictWeavyOptions
    cloudFilePickerUrl: "https://filebrowser.weavy.io/v14/",
    configurationTimeout: 5000,
    disableEnvironmentImports: false,
    gcTime: 1000 * 60 * 60 * 24, // 24h,
    locale: SOURCE_LOCALE,
    notificationEvents: false,
    scrollBehavior: "auto",
    staleTime: 1000 * 1, // 1s
    tokenFactoryRetryDelay: 2000,
    tokenFactoryTimeout: 20000,
    // WeavyComponentSettingProps
    annotations: "buttons-inline",
    enterToSend: "auto",
    notifications: "button-list",
    notificationsBadge: "count",
    reactions: "😍 😎 😉 😜 👍",
  };

  readonly weavySid: string = S4();
  readonly weavyId: string = `${WeavyClient.sourceName}#${this.weavySid}`;

  /**
   * The host where the Weavy context is provided.
   */
  readonly host: HTMLElement;

  // OPTIONS

  cloudFilePickerUrl = WeavyClient.defaults.cloudFilePickerUrl;
  configurationTimeout = WeavyClient.defaults.configurationTimeout;
  disableEnvironmentImports = WeavyClient.defaults.disableEnvironmentImports;
  gcTime = WeavyClient.defaults.gcTime;
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
  get url(): URL | undefined {
    return this.#url;
  }

  set url(url: string | URL | null | undefined) {
    if (this.isDestroyed) {
      throw new DestroyError();
    }

    try {
      if (typeof url === "string") {
        if (url) {
          this.#url = new URL(url, window.location.toString());
        }
      } else if (url instanceof URL) {
        this.#url = url || undefined;
      } else if (url === undefined || url === null) {
        this.#url = undefined;
      } else {
        throw new Error();
      }
    } catch {
      throw new TypeError("Invalid url");
    }

    if (
      url &&
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

  /**
   * Prefix to use for caches.
   */
  get cachePrefix() {
    return `${WeavyClient.version}:${this.url}`;
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
  }

  // eslint-disable-next-line @typescript-eslint/require-await
  async reset() {
    console.info(this.weavyId, "is reset");
  }

  #isDestroyed = false;

  get isDestroyed() {
    return this.#isDestroyed;
  }

  destroy() {
    this.#isDestroyed = true;
    console.info(this.weavyId, "was destroyed");
  }
}

/**
 * Context for Weavy that handles communication with the server, data handling and common options.
 * Requires a `url` to the Weavy environment and an async `tokenFactory` that provides user access tokens.
 *
 * @fires wy-notifications {WyNotificationsEventType}
 */
export class Weavy
  extends WeavyContextProviderMixin(
    WeavyApiMixin(
      WeavyRealtimeMixin(
        WeavyLocalizationMixin(
          WeavyConnectionMixin(
            WeavyNetworkMixin(
              WeavyAuthenticationMixin(
                WeavyQueryMixin(WeavyVersionMixin(WeavyFetchMixin(WeavyStylesMixin(WeavySettingsMixin(WeavyClient)))))
              )
            )
          )
        )
      )
    )
  )
  implements WeavyType {}

export type { WyNotificationsEventType, AppType };
