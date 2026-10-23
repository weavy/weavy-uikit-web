import { LitElement, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import type { FileType } from "../types/files.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";

import contentEmbedCss from "../scss/components/content-embed.scss";
import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-progress-circular";
import "./wy-file-view-icon";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-view-embed": WyFileViewEmbed;
  }
}

/**
 * Lightweight preview wrapper for embedded content.
 *
 * **Used sub components:**
 *
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-file-view-icon>`](./wy-file-view-icon.ts)
 *
 * @csspart wy-content-embed - Object/embed container for the preview.
 * @csspart wy-content-progress - Progress indicator shown while loading.
 * @csspart wy-content-embed-fallback - Fallback view shown when embed cannot load.
 *
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-file-view-embed")
@localized()
export class WyFileViewEmbed extends LitElement {
  static override styles = [contentEmbedCss, hostContentsCss];

  protected exportParts = new ShadowPartsController(this);

  /**
   * Source file.
   */
  @property({ attribute: false })
  file?: FileType;

  /**
   * Cached reference to the active embed element.
   *
   * @internal
   */
  embedElement?: Element;

  /**
   * Emit `file-preview-loaded` once the preview has finished loading.
   *
   * @returns {boolean} True if the event was not canceled.
   */
  protected dispatchLoaded() {
    const event: FilePreviewLoadedEventType = new (CustomEvent as NamedEvent)("file-preview-loaded");
    return this.dispatchEvent(event);
  }

  /**
   * Tear-down callback for the current embed load handler.
   *
   * @internal
   */
  unregisterLoading?: () => void;

  /**
   * Attach load listeners and register the provided embed element.
   *
   * @internal
   * @param embedElement - Newly rendered embed element.
   */
  registerLoading(embedElement: Element | undefined) {
    this.unregisterLoading?.();

    if (embedElement) {
      this.embedElement = embedElement;

      //console.log("register loading", embedElement);

      embedElement.part.add("wy-loading");

      const embedFallbackTimeout = window.setTimeout(() => {
        //console.log("fallback");
        embedElement.part.add("wy-fallback");
        this.dispatchLoaded();
      }, 2500);

      const embedLoaded = (event: Event) => {
        const obj = event.target as Element;
        if (obj.tagName === "OBJECT" && obj.part.contains("wy-loading") && !obj.part.contains("wy-loaded")) {
          //console.log("loaded");
          obj.part.add("wy-loaded");
          window.clearTimeout(embedFallbackTimeout);
          this.dispatchLoaded();
        }
      };

      embedElement.addEventListener("load", embedLoaded, true); // needs capturing

      this.unregisterLoading = () => {
        // cleanup
        if (this.embedElement) {
          embedElement.removeEventListener("load", embedLoaded, true); // needs capturing
          window.clearTimeout(embedFallbackTimeout);
          this.embedElement = undefined;
        }
      };
    }
  }

  override render() {
    const file = this.file;
    if (!file) return nothing;

    const previewSrc = file.preview_url || file.download_url || "";

    /* iframe needs to be object to not render error pages when content is blocked */
    return html`
      <object
        title=${msg("Preview")}
        ${ref((ref) => this.registerLoading(ref))}
        part="wy-content-embed"
        data=${previewSrc}
      ></object>
      <wy-progress-circular part="wy-content-progress" indeterminate overlay></wy-progress-circular>
      <wy-file-view-icon .file=${this.file} part="wy-content-embed-fallback"></wy-file-view-icon>
    `;
  }

  override disconnectedCallback() {
    this.unregisterLoading?.();
    super.disconnectedCallback();
  }
}
