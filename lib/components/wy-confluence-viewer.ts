import { LitElement, type PropertyValueMap, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { createRef, ref } from "lit/directives/ref.js";

import allCss from "../scss/all.scss";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { consume } from "@lit/context";

import { WeavyProps } from "../types/weavy.types";
import { ifDefined } from "lit/directives/if-defined.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { iconNamesType } from "../utils/icons";

import "./wy-spinner";
import "./wy-preview-icon";

//import type { Page } from "@atlaskit/embedded-confluence";

@customElement("wy-confluence-viewer")
export class WyConfluenceViewer extends LitElement {
  static override styles = [
    allCss,
    css`
      :host {
        display: contents;
      }

      .wy-confluence-viewer {
        display: contents;
      }

      .wy-confluence-viewer > * {
        border: none;
        flex: 1;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

  @property()
  src?: string;

  @property()
  icon!: iconNamesType;

  @property()
  raw?: string;

  @property()
  productName?: string;

  @state()
  contentId?: string;

  @state()
  hostname?: string;

  @state()
  spaceKey?: string;

  viewerRef = createRef();

  @state()
  PageComponent?: (props: Omit<React.ComponentProps<React.FC>, "viewComponent" | "editComponent">) => JSX.Element;

  constructor() {
    super();

    console.warn("Using <wy-confluence-picker> is deprecated! Please contact support for using Confluence with Weavy.");
    
    import("@atlaskit/embedded-confluence").then((ConfluenceModule) => {
      this.PageComponent = ConfluenceModule.Page;
    });
  }

  protected override willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>) {
    if (changedProperties.has("weavy") && this.weavy) {
      this.productName ??= this.weavy.confluenceProductName;
    }

    if (changedProperties.has("raw") && this.raw) {
      const rawData = JSON.parse(this.raw);
      this.contentId = rawData.contentId;
      this.hostname = rawData.hostname;
      this.spaceKey = rawData.spaceKey;
    }
  }

  override render() {
    return this.productName
      ? html`
          <div class="wy-confluence-viewer" ${ref(this.viewerRef)}>
            ${!this.contentId || !this.PageComponent ? html` <wy-spinner overlay></wy-spinner> ` : nothing}
          </div>
        `
      : html`
          <wy-preview-icon
            src=${ifDefined(this.src)}
            icon=${this.icon}
            provider=${ifDefined(this.src ? "Confluence" : undefined)}
          ></wy-preview-icon>
        `;
  }

  protected override async updated(changedProperties: PropertyValueMap<this & WeavyProps>) {
    if (
      (changedProperties.has("contentId") ||
        changedProperties.has("PageComponent") ||
        changedProperties.has("productName")) &&
      this.contentId &&
      this.viewerRef.value &&
      //this.productName &&
      this.PageComponent
    ) {
      let React, ReactDOM;

      try {
        React = await import("react");
      } catch (e) {
        console.error("React error", e);
      }

      try {
        ReactDOM = await import("react-dom");
      } catch (e) {
        console.error("ReactDOM error", e);
      }

      if (React && ReactDOM) {
        const page = React.createElement(
          this.PageComponent,
          {
            contentId: this.contentId,
            locale: "en-US",
            hostname: this.hostname,
            parentProduct: this.productName,
            spaceKey: this.spaceKey,
            themeState: "", //"colorMode:dark dark:dark light:light",
          },
          null
        ) as unknown as React.DOMElement<React.DOMAttributes<Element>, Element>;
        ReactDOM.render(page, this.viewerRef.value);
      }
    }
  }
}
