import { html, LitElement, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { Weavy, WeavySettingsProps, type WeavyType } from "./client/weavy";
import type { WeavyTokenFactory, WeavyOptions, StrictWeavyOptions } from "./types/weavy.types";
import { indirectEvalObject } from "./converters/indirect-eval-object";
import { toUrl } from "./converters/url";
import { customElement } from "./utils/decorators/custom-element";

import allStyles from "./scss/all.scss";
import colorModesStyles from "./scss/color-modes.scss";
import hostContentsCss from "./scss/host-contents.scss";

function acceptedValue(value: unknown) {
  return value !== undefined && value !== null && value !== false;
}

export const WY_CONTEXT_TAGNAME = "wy-context";

declare global {
  interface HTMLElementTagNameMap {
    [WY_CONTEXT_TAGNAME]: WyContext;
  }
}

/**
 * Weavy context provider component for configuration of authentication and common settings for Weavy components.
 * 
 * May be used globally on document level if no child nodes are present. When child nodes are present it is limited to the scope of the child nodes.
 *
 * @element wy-context
 * @class WyContext
 * @fires wy-notifications {WyNotificationsEventType}
 * @slot
 */
@customElement(WY_CONTEXT_TAGNAME)
export class WyContext extends LitElement implements StrictWeavyOptions, WeavySettingsProps {
  static override styles = [
    allStyles,
    colorModesStyles,
    hostContentsCss,
  ];

  /**
   * Enables context provider mode.
   * This means only children elements of this element can use this context.
   * This is enabled automatically on initialization when any children elements are present.
   */
  @property({ attribute: true, type: Boolean })
  provider: boolean = false;

  @property()
  annotations = Weavy.defaults.annotations;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  cloudFilePickerUrl = Weavy.defaults.cloudFilePickerUrl;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })

  @property({ attribute: true })
  configurationTimeout = Weavy.defaults.configurationTimeout;
  
  @property({ type: Boolean })
  disableEnvironmentImports = Weavy.defaults.disableEnvironmentImports;

  @property({ attribute: true })
  enterToSend = Weavy.defaults.enterToSend;

  @property({ attribute: true })
  locale = Weavy.defaults.locale;

  @property({ attribute: true, type: Array })
  locales = Weavy.defaults.locales;

  @property({ attribute: true, type: Number })
  gcTime = Weavy.defaults.gcTime;

  @property({ type: Boolean })
  notificationEvents = Weavy.defaults.notificationEvents;

  @property({ attribute: true })
  scrollBehavior = Weavy.defaults.scrollBehavior;

  @property({ attribute: true, type: Number })
  staleTime = Weavy.defaults.staleTime;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => indirectEvalObject<WeavyTokenFactory>(value),
    },
  })
  tokenFactory = Weavy.defaults.tokenFactory;

  @property({ attribute: true, type: Number })
  tokenFactoryRetryDelay = Weavy.defaults.tokenFactoryRetryDelay;

  @property({ attribute: true, type: Number })
  tokenFactoryTimeout = Weavy.defaults.tokenFactoryTimeout;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  tokenUrl? = Weavy.defaults.tokenUrl;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  url? = Weavy.defaults.url;

  @property({ attribute: true })
  notifications = Weavy.defaults.notifications

  @property({ attribute: true })
  notificationsBadge = Weavy.defaults.notificationsBadge;

  @property({ attribute: true })
  reactions = Weavy.defaults.reactions;

  @state()
  protected weavy?: WeavyType;

  /**
   * The semver version of the package.
   */
  get version() {
    return Weavy.version;
  }

  /**
   * The Weavy source name; package name.
   */
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
        if (key !== "weavy" && (acceptedValue(this[key as keyof this & WeavyOptions]) || acceptedValue(changedProperties.get(key as keyof WyContext)))) {
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