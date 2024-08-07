import { LitElement, css, html, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { getTextStreamFromResponse } from "../utils/data";
import { consume } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import { WeavyContextProps } from "../types/weavy.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-empty";
import "./wy-spinner";

import colorModeCss from "../scss/color-modes"
import allCss from "../scss/all"

@customElement("wy-preview-text")
export class WyPreviewText extends LitElement {
  
  static override styles = [
    allCss,
    colorModeCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContextType;

  @property()
  src!: string;

  @property({ type: Boolean })
  html: boolean = false;

  @property({ type: Boolean })
  code: boolean = false;

  @state()
  textOrHtmlContent: string = "";

  @state()
  loading = true;

  override async updated(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    if ((changedProperties.has("weavyContext") || changedProperties.has("src")) && this.weavyContext) {
      this.loading = true;
      fetch(this.src, await this.weavyContext.fetchOptions())
        .then(getTextStreamFromResponse)
        // Create a new response out of the stream
        .then((stream) => new Response(stream))
        // Create an object URL for the response
        .then((response) => response.text())
        .then((text) => {
          this.loading = false;
          this.textOrHtmlContent = text;
        });
    }
  }

  override render() {
    return this.loading ? html`
      <wy-empty><wy-spinner></wy-spinner></wy-empty>
    ` :
    this.html
      ? this.code
        ? html` <div class="wy-content-code wy-code">${unsafeHTML(this.textOrHtmlContent)}</div> `
        : html`
            <div class="wy-document wy-light">
              <div class="wy-content-html">${unsafeHTML(this.textOrHtmlContent)}</div>
            </div>
          `
      : this.code
      ? html` <div class="wy-content-code">${this.textOrHtmlContent}</div> `
      : html`
          <div class="wy-document wy-light">
            <pre class="wy-content-text">${this.textOrHtmlContent}</pre>
          </div>
        `;
  }
}
