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
import type { FileType } from "../types/files.types";

import contentImageCss from "../scss/components/content-image.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-progress-circular";
import "./ui/wy-container";
import { getExtension } from "../utils/files";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-view-image": WyFileViewImage;
  }
}

/**
 * Image preview component used inside file preview overlays.
 *
 * **Used sub components:**
 *
 * - [`<wy-container>`](./ui/wy-container.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 *
 * @csspart wy-content-image - Root image wrapper.
 * @csspart wy-intrinsic-image - Modifier when dimensions are not provided.
 * @csspart wy-content-image-img - The <img> element for the preview.
 * @csspart wy-content-progress - Progress indicator shown while the image loads.
 *
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-file-view-image")
@localized()
export class WyFileViewImage extends LitElement {
  static override styles = [contentImageCss, hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Source file.
   */
  @property({ attribute: false })
  file?: FileType;

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
    const file = this.file;
    if (!file) return nothing;

    const ext = getExtension(file.name);
    let previewSrc = file.preview_url || file.download_url || "";

    // Let GIF and SVG display raw content
    const animatedImage = file.preview_format === "image" && (ext === ".gif" || ext === ".svg");
    if (animatedImage) {
      previewSrc = file.download_url || "";
    }

    const hasDimensions = Boolean(file.width && file.height);
    const imageStyles = hasDimensions ? { ["--width"]: file.width, ["--height"]: file.height } : {};

    return html`
      <wy-container fill>
        <div
          part="wy-content-image ${partMap({ "wy-intrinsic-image": !hasDimensions })}"
          style=${styleMap(imageStyles)}
        >
          <img
            part="wy-content-image-img"
            src=${previewSrc}
            ${ref(checkImageLoad)}
            @load=${(e: Event) => {
              imageLoaded(e);
              this.dispatchLoaded();
            }}
            width=${ifDefined(file.width)}
            height=${ifDefined(file.height)}
            decoding="async"
            alt=${msg("Preview")}
          />
          ${hasDimensions
            ? html`<wy-progress-circular part="wy-content-progress" indeterminate overlay></wy-progress-circular>`
            : nothing}
        </div>
      </wy-container>
    `;
  }
}
