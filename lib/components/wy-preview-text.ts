import { LitElement, html, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { unsafeHTML } from "lit/directives/unsafe-html.js";
import { getTextStreamFromResponse } from "../utils/data";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";

import colorModeCss from "../scss/color-modes.scss";
import contentCodeCss from "../scss/components/content-code.scss";
import contentTextCss from "../scss/components/content-text.scss";
import documentCss from "../scss/components/document.scss";
import codeCss from "../scss/components/code.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./wy-empty";
import "./ui/wy-progress-circular";

declare global {
  interface HTMLElementTagNameMap {
    "wy-preview-text": WyPreviewText;
  }
}

/**
 * Text / code / HTML preview component used in file previews.
 *
 * **Used sub components:**
 *
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
 * @csspart wy-content-progress - Progress indicator shown while loading.
 * @csspart wy-content-code - Container for rendered code content.
 * @csspart wy-code - Modifier for code styling.
 * @csspart wy-document - Document wrapper used for HTML/text rendering.
 * @csspart wy-content-html - Container for rendered HTML.
 * @csspart wy-content-text - Container for plain text content.
 * 
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-preview-text")
export class WyPreviewText extends LitElement {
  static override styles = [colorModeCss, contentTextCss, contentCodeCss, documentCss, codeCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Consumed Weavy client instance used for authenticated fetches.
   *
   * @internal
   */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy?: WeavyType;

  /**
   * Source URL of the text asset to preview.
   */
  @property()
  src!: string;

  /**
   * Render the response as HTML.
   */
  @property({ type: Boolean })
  html: boolean = false;

  /**
   * Apply code styling when rendering text or HTML.
   */
  @property({ type: Boolean })
  code: boolean = false;

  /**
   * Cached string content produced by the latest fetch.
   *
   * @internal
   */
  @state()
  textOrHtmlContent: string = "";

  /**
   * Loading indicator flag while fetching preview content.
   *
   * @internal
   */
  @state()
  loading = true;

  /**
   * Dispatches the `file-preview-loaded` event when content becomes available.
   *
   * @internal
   * @returns {boolean} `true` if the event was not canceled.
   */
  protected dispatchLoaded() {
    const event: FilePreviewLoadedEventType = new (CustomEvent as NamedEvent)("file-preview-loaded");
    return this.dispatchEvent(event);
  }

  override updated(changedProperties: PropertyValueMap<this>) {
    super.updated(changedProperties);

    // TODO: Change the async loading into infinite scrolling
    
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
          this.dispatchLoaded();
        });
    }
  }

  override render() {
    return this.loading
      ? html` <wy-empty><wy-progress-circular part="wy-content-progress" indeterminate></wy-progress-circular></wy-empty> `
      : this.html
      ? this.code
        ? html` <div part="wy-content-code wy-code">${unsafeHTML(this.textOrHtmlContent)}</div> `
        : html`
            <div part="wy-document wy-light">
              <div part="wy-content-html">${unsafeHTML(this.textOrHtmlContent)}</div>
            </div>
          `
      : this.code
      ? html` <div part="wy-content-code">${this.textOrHtmlContent}</div> `
      : html`
          <div part="wy-document wy-light">
            <pre part="wy-content-text">${this.textOrHtmlContent}</pre>
          </div>
        `;
  }
}
