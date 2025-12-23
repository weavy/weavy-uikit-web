import { html, LitElement, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { Weavy, WeavySettingsProps, type WeavyType } from "./client/weavy";
import type { WeavyTokenFactory, WeavyOptions, StrictWeavyOptions } from "./types/weavy.types";
import { indirectEvalObject } from "./converters/indirect-eval-object";
import { toUrl } from "./converters/url";
import { customElement } from "./utils/decorators/custom-element";

import colorModesCss from "./scss/color-modes.scss";
import hostContentsCss from "./scss/host-contents.scss";

function acceptedValue(value: unknown) {
  return value !== undefined && value !== null && value !== false;
}

declare global {
  interface HTMLElementTagNameMap {
    "wy-context": WyContext;
  }
}

/**
 * Weavy context provider component for configuration of authentication and common settings for Weavy components.
 *
 * May be used globally on document level if no child nodes are present. When child nodes are present it is limited to the scope of the child nodes.
 *
 * @tagname wy-context
 * @class WyContext
 * @slot - Default slot for any elements that will have access to the Weavy context provider.
 */
@customElement("wy-context")
export class WyContext extends LitElement implements StrictWeavyOptions, WeavySettingsProps {
  static override styles = [colorModesCss, hostContentsCss];

  /**
   * Enables scoped context mode so only child elements consume the provided context.
   */
  @property({ attribute: true, type: Boolean })
  provider: boolean = false;

  /**
   * Annotation appearance configuration shared with child components.
   *
   * @type {"none" | "buttons-inline"}
   */
  @property()
  annotations = Weavy.defaults.annotations;

  /**
   * URL to the hosted cloud file picker.
   *
   * @type {string | URL}
   */
  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  cloudFilePickerUrl = Weavy.defaults.cloudFilePickerUrl;

  /**
   * Timeout (ms) before configuration is considered to have failed. `Infinity` disables the timeout.
   */
  @property({ type: Number, attribute: true })
  configurationTimeout = Weavy.defaults.configurationTimeout;

  /**
   * Disables dynamic import of modules from the environment.
   */
  @property({ type: Boolean })
  disableEnvironmentImports = Weavy.defaults.disableEnvironmentImports;

  /**
   * Enter-to-send keymap in the editor. `"modifier"` is `Enter` combined with `Ctrl` or `Cmd`. 
   *
   * @type {"never" | "modifier" | "auto" | "always"}
   */
  @property({ attribute: true })
  enterToSend = Weavy.defaults.enterToSend;

  /**
   * Active locale identifier for localization.
   */
  @property({ attribute: true })
  locale = Weavy.defaults.locale;

  /**
   * List of available locales.
   */
  @property({ attribute: true, type: Array })
  locales = Weavy.defaults.locales;

  /**
   * Garbage-collection interval (ms) applied to caches.
   */
  @property({ attribute: true, type: Number })
  gcTime = Weavy.defaults.gcTime;

  /**
   * Which [scroll behavior](https://developer.mozilla.org/en-US/docs/Web/API/Element/scroll#behavior) to use (where applicable). Note that not all browsers (Chrome) have similar scroll transitions, they may be very slow. 
   *
   * @type {"smooth" | "instant" | "auto"}
   */
  @property({ attribute: true })
  scrollBehavior = Weavy.defaults.scrollBehavior;

  /**
   * Default stale time (ms) for TanStack Query caches.
   */
  @property({ attribute: true, type: Number })
  staleTime = Weavy.defaults.staleTime;

  /**
   * Token factory used for acquiring user access tokens.
   */
  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => indirectEvalObject<WeavyTokenFactory>(value),
    },
  })
  tokenFactory = Weavy.defaults.tokenFactory;

  /**
   * Delay (ms) before retrying the token factory.
   */
  @property({ attribute: true, type: Number })
  tokenFactoryRetryDelay = Weavy.defaults.tokenFactoryRetryDelay;

  /**
   * Timeout (ms) applied to the token factory promise.
   */
  @property({ attribute: true, type: Number })
  tokenFactoryTimeout = Weavy.defaults.tokenFactoryTimeout;

  /**
   * Token endpoint used when no token factory is supplied.
   *
   * @type {string | URL | undefined}
   */
  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  tokenUrl? = Weavy.defaults.tokenUrl;

  /**
   * Base URL of the Weavy environment.
   *
   * @type {string | URL | undefined}
   */
  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  url? = Weavy.defaults.url;

  /**
   * Space separated reaction emoji list.
   */
  @property({ attribute: true })
  reactions = Weavy.defaults.reactions;

  /** @internal */
  @state()
  protected weavy?: WeavyType;

  /** The semver version of the package. */
  get version() {
    return Weavy.version;
  }

  /** The Weavy source name; package name. */
  get sourceName() {
    return Weavy.sourceName;
  }

  constructor() {
    super();
    if (this.childElementCount) {
      this.provider = true;
    }

    this.weavy ??= new Weavy({ host: this.provider ? this : undefined });
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    super.willUpdate(changedProperties);

    if (this.weavy) {
      const validProperties = {} as WeavyOptions;

      Array.from(changedProperties.keys()).forEach((key) => {
        if (
          key !== "weavy" &&
          (acceptedValue(this[key as keyof this & WeavyOptions]) ||
            acceptedValue(changedProperties.get(key as keyof WyContext)))
        ) {
          Object.assign(validProperties, { [key as string]: this[key as keyof WeavyOptions] });
        }
      });
      //console.log("wy-context props", validProperties);

      Object.assign(this.weavy, validProperties);
    }
  }

  protected override render() {
    return html` <slot></slot> `;
  }
}
