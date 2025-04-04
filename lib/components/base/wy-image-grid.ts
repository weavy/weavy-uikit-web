import { LitElement, html, nothing } from "lit";
import { customElement } from "../../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ref } from "lit/directives/ref.js";
import type { FileType } from "../../types/files.types";
import type { FileOpenEventType } from "../../types/files.events";
import { checkImageLoad, imageLoaded } from "../../utils/images";
import { partMap } from "../../utils/directives/shadow-part-map";
import { ShadowPartsController } from "../../controllers/shadow-parts-controller";

import imageGridCss from "../../scss/components/image-grid.scss"
import hostContentsCss from "../../scss/host-contents.scss"
import { NamedEvent } from "../../types/generic.types";

@customElement("wy-image-grid")
export default class WyImageGrid extends LitElement {
  static override styles = [imageGridCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  images: FileType[] = [];

  @property({ type: Number })
  limit: number = 3;

  dispatchFileOpen(e: Event, file: FileType) {
    e.preventDefault();
    if (!file.is_trashed) {
      const event: FileOpenEventType = new (CustomEvent as NamedEvent)("file-open", { detail: { fileId: file.id } });
      this.dispatchEvent(event);
    }
  }

  override render() {
    const more = this.images.length > this.limit ? this.images.length - this.limit : 0;
    const images = this.images.slice(0, this.limit);

    return html`
      <div part="wy-image-grid">
        ${images.map((a: FileType, idx: number) => {
          const ratio = a.width && a.height ? a.width / a.height : 1;
          const baseSize = 64;
          const maxScale = 2;
          const flexRatio = ratio.toPrecision(5);
          const flexBasis = (ratio * baseSize).toPrecision(5) + "px";
          const padding = (100 / ratio).toPrecision(5) + "%";
          const intrinsicWidth = a.width + "px";
          const maxWidth = a.width && a.width > 0 ? maxScale * a.width + "px" : "none";
          const fullWidth = this.images.length !== 2 && idx === 0;
          return a.preview_url ? html`
            <a
              href="#"
              @click=${(e: Event) => {
                !e.defaultPrevented && this.dispatchFileOpen(e, a);
              }}
              part=${partMap({
                "wy-image": true,
                "wy-image-full-width": fullWidth 
              })}
              style=${styleMap({
                flexBasis: flexBasis,
                flexGrow: flexRatio,
                flexShrink: flexRatio,
                width: intrinsicWidth,
                maxWidth: maxWidth,
              })}>
              <div part="wy-image-area" style=${styleMap({ paddingBottom: padding })}>
                <img
                  part="wy-image-content"
                  src=${a.preview_url}
                  ${ref(checkImageLoad)}
                  @load=${imageLoaded}
                  alt=""
                  loading="lazy"
                  decoding="async" />
                ${idx === images.length - 1 && more ? html`<span part="wy-image-grid-more">+${more}</span>` : ``}
              </div>
            </a>
          ` : nothing;
        })}
      </div>
    `;
  }
}
