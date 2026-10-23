import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import type { FileType, FileEditableProps, PreviewFormatType } from "../types/files.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { FocusProps } from "../types/component.types";

import hostContentsCss from "../scss/host-contents.scss";

import "./wy-file-view-icon";
import "./wy-file-view-image";
import "./wy-file-view-media";
import "./wy-file-view-text";
import "./wy-file-view-embed";
import "./wy-pdf-viewer";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-view": WyFileView;
  }
}

/**
 * Preview item that selects and renders the appropriate preview component for a file.
 * Renders a child preview component depending on format and metadata.
 *
 * **Used sub components:**
 *
 * - [`<wy-file-view-image>`](./wy-file-view-image.ts)
 * - [`<wy-pdf-viewer>`](./wy-pdf-viewer.ts)
 * - [`<wy-file-view-media>`](./wy-file-view-media.ts)
 * - [`<wy-file-view-text>`](./wy-file-view-text.ts)
 * - [`<wy-file-view-embed>`](./wy-file-view-embed.ts)
 * - [`<wy-file-view-icon>`](./wy-file-view-icon.ts)
 *
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-file-view")
export class WyFileView extends LitElement implements FileEditableProps {
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
   * Edit file if edit mode is available.
   */
  @property({ type: Boolean })
  edit: boolean = false;

  /**
   * Show the unsaved draft of the file instead of its stored content (text files only).
   */
  @property({ type: Boolean })
  draft: boolean = false;

  /**
   * Indicates whether this preview item is the currently visible entry.
   *
   * @internal
   */
  @property({ type: Boolean })
  current: boolean = false;

  /**
   * Saves the current edit.
   */
  async save() {
    await this.viewRef.value?.save?.();
  }

  setFocus() {
    this.viewRef.value?.setFocus?.();
  }

  /**
   * Reference to currently showing view.
   *
   * @internal
   */
  protected viewRef: Ref<LitElement & FileEditableProps & FocusProps> = createRef();

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

    const previewSrc = file.preview_url || file.download_url || "";

    const format: PreviewFormatType = file.is_trashed ? "none" : file.preview_format;

    if (format === "image") {
      return html`<wy-file-view-image
        ${ref(this.viewRef)}
        .file=${file}
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-file-view-image>`;
    } else if (format === "pdf") {
      return html`
        <wy-container padded fill overflow>
          <wy-pdf-viewer
            ${ref(this.viewRef)}
            src=${previewSrc}
            @file-preview-loaded=${() => this.dispatchLoaded()}
          ></wy-pdf-viewer>
        </wy-container>
      `;
    } else if (format === "video" || format === "audio") {
      return html`<wy-file-view-media
        ${ref(this.viewRef)}
        .file=${file}
        ?play=${this.current}
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-file-view-media>`;
    } else if (format === "text" || format === "code" || format === "html") {
      return html`<wy-file-view-text
        ${ref(this.viewRef)}
        .file=${file}
        .edit=${this.edit && this.current}
        .draft=${this.draft && this.current}
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-file-view-text>`;
    } else if (format === "embed") {
      return html`<wy-file-view-embed
        ${ref(this.viewRef)}
        .file=${file}
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-file-view-embed>`;
    } else if (format === "none") {
      return html`<wy-file-view-icon
        ${ref(this.viewRef)}
        .file=${file}
        @file-preview-loaded=${() => this.dispatchLoaded()}
      ></wy-file-view-icon>`;
    } else {
      return nothing;
    }
  }
}
