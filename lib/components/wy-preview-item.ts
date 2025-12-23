import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { getExtension, getIcon } from "../utils/files";
import type { FileProviderType, FileType, PreviewFormatType } from "../types/files.types";
import { ifDefined } from "lit/directives/if-defined.js";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";

import hostContentsCss from "../scss/host-contents.scss";

import "./wy-preview-icon";
import "./wy-preview-image";
import "./wy-preview-media";
import "./wy-preview-text";
import "./wy-preview-embed";
import "./wy-pdf-viewer";

declare global {
  interface HTMLElementTagNameMap {
    "wy-preview-item": WyPreviewItem;
  }
}

/**
 * Preview item that selects and renders the appropriate preview component for a file.
 * Renders a child preview component depending on format and metadata.
 *
 * **Used sub components:**
 *
 * - [`<wy-preview-image>`](./wy-preview-image.ts)
 * - [`<wy-pdf-viewer>`](./wy-pdf-viewer.ts)
 * - [`<wy-preview-media>`](./wy-preview-media.ts)
 * - [`<wy-preview-text>`](./wy-preview-text.ts)
 * - [`<wy-preview-embed>`](./wy-preview-embed.ts)
 * - [`<wy-preview-icon>`](./wy-preview-icon.ts)
 *
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-preview-item")
export class WyPreviewItem extends LitElement {
  static override styles = [hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * File metadata that determines which preview renderer to display.
   *
   * @internal
   */
  @property({ type: Object })
  file?: FileType;

  /**
   * Indicates whether this preview item is the currently visible entry.
   *
   * @internal
   */
  @property({ type: Boolean })
  current: boolean = false;

  /**
   * Emits the `file-preview-loaded` event when the preview has finished loading.
   *
   * @internal
   * @returns {boolean} `true` if the event was not canceled.
   */
  dispatchLoaded() {
    const event: FilePreviewLoadedEventType = new (CustomEvent as NamedEvent)("file-preview-loaded", {
      detail: { file: this.file },
    });
    return this.dispatchEvent(event);
  }

  override render() {
    const file = this.file;
    if (!file) return nothing;

    const { icon } = getIcon(file.name);
    const ext = getExtension(file.name);

    let previewSrc = file.preview_url || file.download_url || "";

    // Let GIF and SVG display raw content
    const animatedImage = file.preview_format === "image" && (ext === ".gif" || ext === ".svg");
    if (animatedImage) {
      previewSrc = file.download_url || "";
    }

    const src: string = previewSrc,
      link: string | undefined = file.external_url,
      format: PreviewFormatType = file.is_trashed ? "none" : file.preview_format,
      name: string = file.name,
      width: number | undefined = file.width,
      height: number | undefined = file.height,
      mediaType: string = file.media_type,
      provider: FileProviderType | undefined = file.provider;

    if (format === "image") {
      return html`<wy-preview-image
        src=${src}
        width=${ifDefined(width)}
        height=${ifDefined(height)}
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-preview-image>`;
    } else if (format === "pdf") {
      return html`<wy-pdf-viewer src=${src} @file-preview-loaded=${() => this.dispatchLoaded()}></wy-pdf-viewer>`;
    } else if (format === "video" || format === "audio") {
      return html`<wy-preview-media
        format=${format}
        src=${src}
        name=${name}
        mediaType=${mediaType}
        ?play=${this.current}
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-preview-media>`;
    } else if (format === "text") {
      return html`<wy-preview-text src=${src} @file-preview-loaded=${() => this.dispatchLoaded()}></wy-preview-text>`;
    } else if (format === "code") {
      return html`<wy-preview-text
        src=${src}
        ?html=${!/^(?:blob:|data:)/.test(src)}
        code
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-preview-text>`;
    } else if (format === "html") {
      return html`<wy-preview-text
        src=${src}
        html
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-preview-text>`;
    } else if (format === "embed") {
      return html`<wy-preview-embed
        src=${src}
        name=${name}
        icon=${icon}
        provider=${ifDefined(provider)}
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-preview-embed>`;
    } else if (format === "none") {
      return link
        ? html`<wy-preview-icon
            src=${link}
            icon=${icon}
            provider=${ifDefined(provider)}
            @file-preview-loaded=${() => this.dispatchLoaded()}
          ></wy-preview-icon>`
        : html`<wy-preview-icon
            src=${src}
            icon=${icon}
            @file-preview-loaded=${() => this.dispatchLoaded()}
          ></wy-preview-icon>`;
    } else {
      return nothing;
    }
  }
}
