import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { checkImageLoad, imageLoaded } from "../utils/images";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { partMap } from "../utils/directives/shadow-part-map";
import { ifDefined } from "lit/directives/if-defined.js";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";

import contentImageCss from "../scss/components/content-image.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-progress-circular";

declare global {
  interface HTMLElementTagNameMap {
    "wy-preview-image": WyPreviewImage;
  }
}

/**
 * Image preview component used inside file preview overlays.
 *
 * **Used sub components:**
 *
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
 * @csspart wy-content-image - Root image wrapper.
 * @csspart wy-intrinsic-image - Modifier when dimensions are not provided.
 * @csspart wy-content-image-img - The <img> element for the preview.
 * @csspart wy-content-progress - Progress indicator shown while the image loads.
 * 
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-preview-image")
@localized()
export class WyPreviewImage extends LitElement {
  static override styles = [contentImageCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Source URL of the image to preview.
   */
  @property()
  src!: string;

  /**
   * Intrinsic width of the preview image in pixels.
   */
  @property({ type: Number })
  width?: number;

  /**
   * Intrinsic height of the preview image in pixels.
   */
  @property({ type: Number })
  height?: number;

  /**
   * Dispatches the `file-preview-loaded` event once the image has loaded.
   *
   * @internal
   */
  protected dispatchLoaded() {
    const event: FilePreviewLoadedEventType = new (CustomEvent as NamedEvent)("file-preview-loaded");
    return this.dispatchEvent(event);
  }

  override render() {
    const hasDimensions = Boolean(this.width && this.height);
    const imageStyles = hasDimensions ? { ["--width"]: this.width, ["--height"]: this.height } : {};

    return html`
      <div part="wy-content-image ${partMap({ "wy-intrinsic-image": !hasDimensions })}" style=${styleMap(imageStyles)}>
        <img
          part="wy-content-image-img"
          src=${this.src}
          ${ref(checkImageLoad)}
          @load=${(e: Event) => {
            imageLoaded(e);
            this.dispatchLoaded();
          }}
          width=${ifDefined(this.width)}
          height=${ifDefined(this.height)}
          decoding="async"
          alt=${msg("Preview")}
        />
        ${hasDimensions
          ? html`<wy-progress-circular part="wy-content-progress" indeterminate overlay></wy-progress-circular>`
          : nothing}
      </div>
    `;
  }
}
