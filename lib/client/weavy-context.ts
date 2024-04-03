
import { S4 } from "../utils/data";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { globalContextProvider, weavyContextDefinition } from "./context-definition";

import { chrome } from "../utils/browser";
import type { WeavyOptions, Destructable, WeavyContextOptionsType } from "../types/weavy.types";
import { DestroyError } from "../utils/errors";
import { toUrl } from "../converters/url";

import { SOURCE_LOCALE, WeavyLocalizationMixin, type WeavyLocalizationProps } from "./localization";
import { WeavyNetworkMixin, type WeavyNetworkProps } from "./network";
import { WeavyAuthenticationMixin, type WeavyAuthenticationProps } from "./authentication";
import { WeavyConnectionMixin, type WeavyConnectionProps } from "./connection";
import { WeavyQueryMixin, type WeavyQueryProps } from "./query";
import { WeavyVersionMixin, type WeavyVersionProps } from "./version";
import { WeavyModalsMixin, type WeavyModalsProps } from "./modals";
import { WeavyFetchMixin, type WeavyFetchProps } from "./fetch";
import { WeavyStylesMixin, type WeavyStylesProps } from "./styles";

export type WeavyContextType = WeavyContext &
  WeavyLocalizationProps &
  WeavyNetworkProps &
  WeavyAuthenticationProps &
  WeavyConnectionProps &
  WeavyQueryProps &
  WeavyVersionProps &
  WeavyModalsProps &
  WeavyFetchProps &
  WeavyStylesProps;

/**
 * Context for Weavy that handles communication with the server, data handling and common options.
 * Requires a `url` to the Weavy environment and an async `tokenFactory` that provides user access tokens.
 */
@WeavyLocalizationMixin
@WeavyNetworkMixin
@WeavyAuthenticationMixin
@WeavyConnectionMixin
@WeavyQueryMixin
@WeavyVersionMixin
@WeavyModalsMixin
@WeavyFetchMixin
@WeavyStylesMixin
export class WeavyContextBase implements WeavyOptions, Destructable {
  /**
   * The semver version of the package.
   */
  static readonly version: string = WEAVY_VERSION;

  /**
   * The Weavy source name; package name.
   */
  static readonly sourceName: string = WEAVY_SOURCE_NAME;

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

  /**
   * The host where the Weavy context is provided.
   */
  readonly host: HTMLElement = document.documentElement;

  #hostContextProvider?: ContextProvider<typeof weavyContextDefinition>;


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
  }

  // CONSTRUCTOR

  constructor(options: WeavyContextOptionsType) {
    console.info(`${WeavyContextBase.sourceName}@${WeavyContextBase.version} #${this.weavySid}`);

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

    // Context root

    if (this.host !== document.documentElement) {
      globalContextProvider.detachListeners();
      this.#hostContextProvider = new ContextProvider(this.host, {
        context: weavyContextDefinition,
        initialValue: this as unknown as WeavyContextType,
      });
    } else {
      globalContextProvider.setValue(this as unknown as WeavyContextType);
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

export class WeavyContext extends WeavyContextBase {}
export const Weavy = WeavyContext;