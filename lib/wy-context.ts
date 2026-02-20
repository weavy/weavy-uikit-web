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
 * The Weavy context component provides a declarative way of [initializing the Weavy UIKit](https://www.weavy.com/docs/reference/uikit) that does not require creating an instance of the `Weavy` class. 
 * This can be useful in some scenarios, for instance in low-code and no-code platforms with limited javascript functionality.
 *
 * When used with child nodes, the Weavy context acts a regular [context provider](https://github.com/webcomponents-cg/community-protocols/blob/main/proposals/context.md), which makes the configuration available to it's child nodes only. 
 * If no child nodes are present, the configuration is instead available globally in the DOM.
 *
 * To use the context component in the UIKit you need initialize it with the `url` to your [environment](https://www.weavy.com/docs/learn/environment) and `tokenFactory`/`tokenUrl` for [authentication](https://www.weavy.com/docs/learn/authentication).
 * 
 * > For use with React, you can instead use the standard React context provider or the `useWeavy` configuration hook, available in the `@weavy/uikit-react` package. See [Getting started with Weavy using React](https://www.weavy.com/docs/get-started/react) on how to configure Weavy in React. 
 * 
 * **Component layout**
 * 
 * This component does not render or occupy any visual space in the rendering.
 * 
 * You can add additional styling for _other_ child Weavy components using [CSS Custom Properties](https://www.weavy.com/docs/learn/styling).
 * 
 * @tagname wy-context
 * @slot - Default slot for any elements that will have access to the Weavy context provider.
 * 
 * @example <caption>Globally available Weavy context</caption>
 * 
 * The context component is place by itself without any children and becomes available to the entire DOM.
 * 
 * It's configured with a `tokenUrl` endpoint that needs to be implemented and provided at your server.
 * 
 * ```html
 * <wy-context
 *   url="{WEAVY-URL}"
 *   tokenUrl="https://example.com/myapp/token"
 * ></wy-context>
 * ...
 * <h1>Messenger with standard weavy configuration</h1>
 * <wy-messenger></wy-messenger>
 * ```
 * 
 * @example <caption>Scoped Weavy context provider</caption>
 * 
 * Placing components as children to the context makes the configuration only available to it's children.
 * 
 * It's configured with a `tokenUrl` endpoint that needs to be implemented and provided at your server.
 * 
 * ```html
 * <wy-context url="{WEAVY-URL}" tokenUrl="https://example.com/myapp/token">
 *   <h1>Messenger inside a weavy context provider</h1>
 *   <wy-messenger></wy-messenger>
 * </wy-context>
 * ```
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
   * URL to the hosted cloud file picker. This usually does not need to be provided unless you intend to host your own Weavy cloud file picker.
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

  /** The Weavy source format; file format. */
  get sourceFormat() {
    return Weavy.sourceFormat;
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
