import { css, html, LitElement, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";

import { WeavyContext } from "./client/weavy-context";
import type { WeavyTokenFactory, WeavyOptions } from "./types/weavy.types";

import { indirectEvalObject } from "./converters/indirect-eval-object";
import { toUrl } from "./converters/url";
import { LocaleModule } from "@lit/localize";

@customElement("wy-context")
export class WyContext extends LitElement implements WeavyOptions {
  static override styles = [
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
  confluenceAuthenticationUrl?: string | URL;

  @property({ attribute: true })
  confluenceProductName?: string;

  @property({ type: Boolean })
  disableEnvironmentImports?: boolean;

  @property({ attribute: true })
  locale?: string;

  @property({ attribute: true, type: Array })
  locales?: Array<[string, LocaleModule | Promise<LocaleModule> | (() => Promise<LocaleModule>)]>;

  @property({ attribute: true, type: Number })
  gcTime?: number;

  @property({ attribute: true })
  modalParent?: string;

  @property({ attribute: true, type: Array })
  reactions?: string[];

  @property({ attribute: true })
  scrollBehavior?: "smooth" | "instant" | "auto";

  @property({ attribute: true, type: Number })
  staleTime?: number;

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => indirectEvalObject<WeavyTokenFactory>(value!),
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

  @property({
    attribute: true,
    converter: {
      fromAttribute: (value) => toUrl(value),
    },
  })
  zoomAuthenticationUrl?: string | URL;

  @state()
  protected weavyContext?: WeavyContext;

  /**
   * The semver version of the package.
   */
  readonly version: string = WeavyContext.version;

  /**
   * The Weavy source name; package name.
   */
  readonly sourceName: string = WeavyContext.sourceName;

  constructor() {
    super();
    if (this.childElementCount) {
      this.provider = true;
    }

    this.weavyContext ??= new WeavyContext({ host: this.provider ? this : undefined });
  }

  protected override willUpdate(changedProperties: PropertyValues<this>): void {
    if (this.weavyContext) {
      const validProperties = {} as WeavyOptions;
      
      Array.from(changedProperties.keys()).forEach((key) => {
        if (key !== "weavyContext" && this[key as keyof this & WeavyOptions]) {
          Object.assign(validProperties, { [key as string]: this[key as keyof WeavyOptions] });
        }
      });
      //console.log("wy-context props", validProperties)

      Object.assign(this.weavyContext, validProperties);
    }
  }

  protected override render() {
    return html` <slot></slot> `;
  }
}
