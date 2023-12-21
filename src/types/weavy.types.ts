import { LocaleModule } from "@lit/localize";
import { type WeavyContext } from "../client/weavy-context";

/**
 * Async function returning an `access_token` string for _your_ authenticated user. A boolean `refresh` parameter is provided to let you now if a fresh token is needed from Weavy.
 */
export type WeavyTokenFactory = (refresh: boolean) => Promise<string>;

export interface WeavyOptions {
  /**
   * The url to the cloud file picker.
   */
  cloudFilePickerUrl?: string | URL;

  /**
   * Selected locale. The locale must be pre configured in `.locales`.
   */
  locale?: string;

  /**
   * Array of enabled locales. The corresponding locales must be available for loading as a locale .js file.
   */
  locales?: string[];

  /**
   * The base url where locale .js files can be found.
   */
  localesUrl?: string | URL;

  /**
   * Map with preloaded locale template modules. Locale is key and the locale module or promise is value.
   */
  localizedTemplates?: Map<string, LocaleModule | Promise<LocaleModule>>;

  /**
   * The max-allowed age of the cache in milliseconds. If a persisted cache is found that is older than this time, it will be discarded.
   * If set to `Infinity`, the cache will never be considered old.
   */
  gcTime?: number;

  /**
   * Element query selector for where to attach modals.
   * Defaults to `body` but can be optionally be set to `html` to provide compatibility with some frameworks.
   * > Note that any font styles must be provided using `:root` or `html` when using the `html` selector.
   */
  modalParent?: string;

  /**
   * An array of available reaction emojis in unicode.
   */
  reactions?: string[];

  /**
   * Which scroll behavior to use (where applicable).
   * > Note that not all browsers (Chrome) have similar scroll transitions, they may be very slow.
   * See https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll#behavior
   */
  scrollBehavior?: "smooth" | "instant" | "auto";

  /**
   * The time in milliseconds after data is considered stale.
   * If set to `Infinity`, the data will never be considered stale.
   */
  staleTime?: number;

  /**
   * Async function returning an `access_token` string for _your_ authenticated user. A boolean `refresh` parameter is provided to let you now if a fresh token is needed from Weavy.
   */
  tokenFactory?: WeavyTokenFactory;

  /**
   * The time allowed to pass before tokenFactory is considered to have timed out.
   * `Infinity` disables the timeout.
   */
  tokenFactoryTimeout?: number;

  /**
   * The URL to the weavy environment.
   */
  url?: string | URL;

  /**
   * The url for zoom authentication.
   */
  zoomAuthenticationUrl?: string | URL;
}

export type WeavyContextProps = { weavyContext: WeavyContext };
