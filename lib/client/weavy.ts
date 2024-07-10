import { S4 } from "../utils/data";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { globalContextProvider, weavyContextDefinition } from "../contexts/weavy-context";

import { chrome } from "../utils/browser";
import type { WeavyOptions, Destructable, WeavyContextOptionsType } from "../types/weavy.types";
import { DestroyError } from "../utils/errors";

import { SOURCE_LOCALE, WeavyLocalizationMixin, WeavyLocalizationProps } from "./localization";
import { WeavyNetworkMixin, WeavyNetworkProps } from "./network";
import { WeavyAuthenticationMixin, WeavyAuthenticationProps } from "./authentication";
import { WeavyConnectionMixin, WeavyConnectionProps } from "./connection";
import { WeavyQueryMixin, WeavyQueryProps } from "./query";
import { WeavyVersionMixin, WeavyVersionProps } from "./version";
import { WeavyFetchMixin, WeavyFetchProps } from "./fetch";
import { WeavyStylesMixin, WeavyStylesProps } from "./styles";
import { WeavyRealtimeMixin, WeavyRealtimeProps } from "./realtime";

export type WeavyContextMixins = WeavyContextBase &
  WeavyNetworkProps &
  WeavyAuthenticationProps &
  WeavyLocalizationProps &
  WeavyConnectionProps &
  WeavyQueryProps &
  WeavyVersionProps &
  WeavyFetchProps &
  WeavyStylesProps &
  WeavyRealtimeProps;

/**
 * Context for Weavy that handles communication with the server, data handling and common options.
 * Requires a `url` to the Weavy environment and an async `tokenFactory` that provides user access tokens.
 */
export class WeavyContextBase implements WeavyOptions, Destructable {
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
    zoomAuthenticationUrl: undefined,
  };

  readonly weavySid: string = S4();
  readonly weavyId: string = `${WeavyContextBase.sourceName}#${this.weavySid}`;

  /**
   * The host where the Weavy context is provided.
   */
  readonly host: HTMLElement = document.documentElement;

  #hostContextProvider?: ContextProvider<typeof weavyContextDefinition>;

  // OPTIONS

  cloudFilePickerUrl = WeavyContextBase.defaults.cloudFilePickerUrl;
  confluenceAuthenticationUrl = WeavyContextBase.defaults.confluenceAuthenticationUrl;
  confluenceProductName = WeavyContextBase.defaults.confluenceProductName;
  disableEnvironmentImports = WeavyContextBase.defaults.disableEnvironmentImports;
  gcTime = WeavyContextBase.defaults.gcTime;
  reactions = WeavyContextBase.defaults.reactions;
  scrollBehavior = WeavyContextBase.defaults.scrollBehavior;
  staleTime = WeavyContextBase.defaults.staleTime;
  tokenFactoryRetryDelay = WeavyContextBase.defaults.tokenFactoryRetryDelay;
  tokenFactoryTimeout = WeavyContextBase.defaults.tokenFactoryTimeout;

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
    } catch (e) {
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

  // DEPRECATED

  #zoomAuthenticationUrl?: string | URL;

  get zoomAuthenticationUrl() {
    return this.#zoomAuthenticationUrl ?? WeavyContextBase.defaults.zoomAuthenticationUrl;
  }

  set zoomAuthenticationUrl(url: string | URL | undefined) {
    console.warn(`Setting "zoomAuthenticationUrl" is deprecated. Configure Zoom on your Weavy Environment instead.`);
    this.#zoomAuthenticationUrl = url;
  }

  // CONSTRUCTOR

  constructor(options?: WeavyContextOptionsType) {
    console.info(`${WeavyContextBase.sourceName}@${WeavyContextBase.version} #${this.weavySid}`);

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
      globalContextProvider.detachListeners();
      this.#hostContextProvider = new ContextProvider(this.host, {
        context: weavyContextDefinition,
        initialValue: this as unknown as WeavyContext,
      });
    } else {
      globalContextProvider.setValue(this as unknown as WeavyContext);
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

export class WeavyContext
  extends WeavyRealtimeMixin(
    WeavyLocalizationMixin(
      WeavyConnectionMixin(
        WeavyNetworkMixin(
          WeavyAuthenticationMixin(
            WeavyQueryMixin(WeavyVersionMixin(WeavyFetchMixin(WeavyStylesMixin(WeavyContextBase))))
          )
        )
      )
    )
  )
  implements WeavyContextMixins {}

export class Weavy extends WeavyContext {}
export type WeavyContextType = WeavyContext;
