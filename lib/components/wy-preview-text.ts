import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getTextStreamFromResponse } from "../utils/data";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-empty";
import "./base/wy-spinner";

import colorModeCss from "../scss/color-modes.scss";
import allCss from "../scss/all.scss";
import hostContentsCss from "../scss/host-contents.scss";

@customElement("wy-preview-text")
export class WyPreviewText extends LitElement {
  static override styles = [allCss, colorModeCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy?: WeavyType;

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

  override updated(changedProperties: PropertyValueMap<this>) {
    super.updated(changedProperties);
    
    if ((changedProperties.has("weavy") || changedProperties.has("src")) && this.weavy) {
      this.loading = true;
      void this.weavy
        .fetchOptions()
        .then((fetchOptions) => fetch(this.src, fetchOptions))
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
    return this.loading
      ? html` <wy-empty><wy-spinner></wy-spinner></wy-empty> `
      : this.html
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
