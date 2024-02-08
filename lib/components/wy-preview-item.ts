import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";

import "./wy-preview-icon";
import "./wy-preview-image";
import "./wy-preview-media";
import "./wy-preview-text";
import "./wy-preview-embed";
import "./wy-pdf-viewer";

import allCss from "../scss/all.scss";

import { getExtension, getIcon } from "../utils/files";
import type { FileType, PreviewFormatType } from "../types/files.types";

import type { FeaturesConfigType, FeaturesListType } from "../types/features.types";
import { ifDefined } from "lit/directives/if-defined.js";

@customElement("wy-preview-item")
export class WyPreviewItem extends LitElement {
  
  static override styles = [
    allCss,
    css`
      :host {
        display: contents;
      }
    `,
  ];

  @property({ type: Object })
  file?: FileType;

  @property({ type: Array })
  availableFeatures: FeaturesListType = [];

  @property({ type: Object })
  features: FeaturesConfigType = {};

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
      provider: string | undefined = file.provider;

    if (format === "image") {
      return html`<wy-preview-image src=${src} width=${ifDefined(width)} height=${ifDefined(height)}></wy-preview-image>`;
    } else if (format === "pdf") {
      return html`<wy-pdf-viewer src=${src}></wy-pdf-viewer>`;
    } else if (format === "video" || format === "audio") {
      return html`<wy-preview-media
        format=${format}
        src=${src}
        name=${name}
        mediaType=${mediaType}></wy-preview-media>`;
    } else if (format === "text") {
      return html`<wy-preview-text src=${src}></wy-preview-text>`;
    } else if (format === "code") {
      return html`<wy-preview-text src=${src} ?html=${!/^(?:blob:|data:)/.test(src)} code></wy-preview-text>`;
    } else if (format === "html") {
      return html`<wy-preview-text src=${src} html></wy-preview-text>`;
    } else if (format === "embed") {
      return html`<wy-preview-embed src=${src} name=${name} icon=${icon} provider=${ifDefined(provider)}></wy-preview-embed>`;
    } else if (format === "none") {
      return link
        ? html`<wy-preview-icon src=${link} icon=${icon} provider=${ifDefined(provider)}></wy-preview-icon>`
        : html`<wy-preview-icon src=${src} icon=${icon}></wy-preview-icon>`;
    } else {
      return nothing;
    }
  }
}
