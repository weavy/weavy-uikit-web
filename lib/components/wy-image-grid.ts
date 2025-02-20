import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ref } from "lit/directives/ref.js";
import type { FileOpenEventType, FileType } from "../types/files.types";
import { checkImageLoad, imageLoaded } from "../utils/images";

import chatCss from "../scss/all.scss"

@customElement("wy-image-grid")
export default class WyImageGrid extends LitElement {
  static override styles = chatCss;

  //protected exportParts = new ShadowPartsController(this);

  override createRenderRoot() {
    // Review: needed?
    return this;
  }

  @property({ attribute: false })
  images: FileType[] = [];

  @property({ type: Number })
  limit: number = 3;

  dispatchFileOpen(e: Event, file: FileType) {
    e.preventDefault();
    if (!file.is_trashed) {
      const event: FileOpenEventType = new CustomEvent("file-open", { detail: { fileId: file.id } });
      this.dispatchEvent(event);
    }
  }

  override render() {
    const more = this.images.length > this.limit ? this.images.length - this.limit : 0;
    const images = this.images.slice(0, this.limit);

    return html`
      <div class="wy-image-grid">
        ${images.map((a: FileType, idx: number) => {
          const ratio = a.width && a.height ? a.width / a.height : 1;
          const baseSize = 64;
          const maxScale = 2;
          const flexRatio = ratio.toPrecision(5);
          const flexBasis = (ratio * baseSize).toPrecision(5) + "px";
          const padding = (100 / ratio).toPrecision(5) + "%";
          const intrinsicWidth = a.width + "px";
          const maxWidth = a.width && a.width > 0 ? maxScale * a.width + "px" : "none";
          return a.preview_url ? html`
            <a
              href="#"
              @click=${(e: Event) => {
                !e.defaultPrevented && this.dispatchFileOpen(e, a);
              }}
              class="wy-image"
              style=${styleMap({
                flexBasis: flexBasis,
                flexGrow: flexRatio,
                flexShrink: flexRatio,
                width: intrinsicWidth,
                maxWidth: maxWidth,
              })}>
              <div class="wy-image-area" style=${styleMap({ paddingBottom: padding })}>
                <img
                  src=${a.preview_url}
                  ${ref(checkImageLoad)}
                  @load=${imageLoaded}
                  alt=""
                  loading="lazy"
                  decoding="async" />
                ${idx === images.length - 1 && more ? html`<span class="wy-more">+${more}</span>` : ``}
              </div>
            </a>
          ` : nothing;
        })}
      </div>
    `;
  }
}
