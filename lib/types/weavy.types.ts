import { LocaleModule } from "@lit/localize";
import { WeavyType } from "../client/weavy";
import { Nullable } from "./generic.types";
import { WeavyComponentSettingProps } from "../classes/weavy-component";
/**
 * Async function returning an `access_token` string for _your_ authenticated user. A boolean `refresh` parameter is provided to let you now if a fresh token is needed from Weavy.
 */
export type WeavyTokenFactory = (refresh: boolean) => Promise<string | null | undefined>;

export interface StrictWeavyOptions {
  /**
   * The url to the cloud file picker.
   */
  cloudFilePickerUrl: string | URL;

  /**
   * Should the dynamic import of modules from the environment be disabled?
   */
  disableEnvironmentImports: boolean;

  /**
   * Selected locale. The locale must be pre configured in `.locales`.
   */
  locale: string;

  /**
   * Array with locale template modules. The corresponding locales must be available for loading as a locale .js file.
   * Locale is key and the locale module, promise or async function is value.
   */
  locales?: Array<[string, LocaleModule | Promise<LocaleModule> | (() => Promise<LocaleModule>)]>;

  /**
   * The max-allowed age of the cache in milliseconds. If a persisted cache is found that is older than this time, it will be discarded.
   * If set to `Infinity`, the cache will never be considered old.
   */
  gcTime: number;

  /**
   * Enable the realtime `wy-notifications` event.
   */
  notificationEvents: boolean;

  /**
   * Which scroll behavior to use (where applicable).
   * > Note that not all browsers (Chrome) have similar scroll transitions, they may be very slow.
   * See https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll#behavior
   */
  scrollBehavior: "smooth" | "instant" | "auto";

  /**
   * The time in milliseconds after data is considered stale.
   * If set to `Infinity`, the data will never be considered stale.
   */
  staleTime: number;

  /**
   * An URL to an endpoint returning an JSON data containing an `access_token` string property for _your_ authenticated user. A boolean `refresh=true` query parameter is provided in the request to let you now if when a fresh token is needed from Weavy.
   */
  tokenUrl?: string | URL;

  /**
   * Async function returning an `access_token` string for _your_ authenticated user. A boolean `refresh` parameter is provided to let you now if a fresh token is needed from Weavy.
   */
  tokenFactory?: WeavyTokenFactory;

  /**
   * The time between tokenFactory attempts when a valid token isn't provided yet.
   */
  tokenFactoryRetryDelay: number;

  /**
   * The time allowed to pass before tokenFactory is considered to have timed out.
   * `Infinity` disables the timeout.
   */
  tokenFactoryTimeout: number;

  /**
   * The URL to the weavy environment.
   */
  url?: string | URL;
}

export type WeavyOptions = Nullable<Partial<StrictWeavyOptions & WeavyComponentSettingProps>>

export type WeavyProps = { weavy: WeavyType };

export type WeavyClientOptionsType =
  | (WeavyOptions & {
      /**
       * The host where the Weavy context is provided.
       */
      host?: HTMLElement | undefined;
    })
  | undefined;

export interface Destructable {
  readonly isDestroyed: boolean;
  destroy: () => void;
}
