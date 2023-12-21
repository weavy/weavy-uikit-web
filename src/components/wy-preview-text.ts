import { LitElement, css, html, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";

import { getTextStreamFromResponse } from "../utils/data";

import "./wy-empty";
import "./wy-spinner";

import allCss from "../scss/all.scss";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-preview-text")
export class WyPreviewText extends LitElement {
  
  static override styles = [
    allCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

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

  override async updated(changedProperties: PropertyValues<this & WeavyContextProps>) {
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
            <div class="wy-document">
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
