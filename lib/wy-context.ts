import { css, html, LitElement, type PropertyValues } from "lit";
import { property, state } from "lit/decorators.js";
import { Weavy, type WeavyType } from "./client/weavy";
import type { WeavyTokenFactory, WeavyOptions } from "./types/weavy.types";
import { indirectEvalObject } from "./converters/indirect-eval-object";
import { toUrl } from "./converters/url";
import { LocaleModule } from "@lit/localize";
import { customElement } from "./utils/decorators/custom-element";

import allStyles from "./scss/all.scss";
import colorModesStyles from "./scss/color-modes.scss";

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
export class WyContext extends LitElement implements WeavyOptions {
  static override styles = [
    allStyles,
    colorModesStyles,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  /**
   * Enables context provider mode.
   * This means only children elements of this element can use this context.
   * This is enabled automatically on initialization when any children elements are present.
   */
  @property({ attribute: true, type: Boolean })
  provider: boolean = false;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  cloudFilePickerUrl?: string | URL;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  
  @property({ type: Boolean })
  disableEnvironmentImports?: boolean;

  @property({ attribute: true })
  locale?: string;

  @property({ attribute: true, type: Array })
  locales?: Array<[string, LocaleModule | Promise<LocaleModule> | (() => Promise<LocaleModule>)]>;

  @property({ attribute: true, type: Number })
  gcTime?: number;

  @property({ attribute: true, type: Array })
  reactions?: string[];

  @property({ type: Boolean })
  notificationEvents?: boolean;

  @property({ type: Boolean })
  notificationToasts?: boolean;

  @property({ attribute: true })
  scrollBehavior?: "smooth" | "instant" | "auto";

  @property({ attribute: true, type: Number })
  staleTime?: number;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => indirectEvalObject<WeavyTokenFactory>(value),
    },
  })
  tokenFactory?: WeavyTokenFactory;

  @property({ attribute: true, type: Number })
  tokenFactoryRetryDelay?: number;

  @property({ attribute: true, type: Number })
  tokenFactoryTimeout?: number;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  tokenUrl?: string | URL;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  url?: string | URL;

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