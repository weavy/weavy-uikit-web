import { LitElement, PropertyValues, html, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg, str } from "@lit/localize";
import { getIcon, getProvider } from "../utils/files";
import type { FileType } from "../types/files.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-icon";
import "./ui/wy-button";

declare global {
  interface HTMLElementTagNameMap {
    "wy-file-view-icon": WyFileViewIcon;
  }
}

/**
 * Fallback preview display used when no inline preview is available.
 * Displays an icon and an optional link to open the source.
 *
 * **Used sub components:**
 *
 * - [`<wy-icon-display>`](./ui/wy-icon.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 *
 * @fires {FilePreviewLoadedEventType} file-preview-loaded - The file preview is considered loaded.
 */
@customElement("wy-file-view-icon")
@localized()
export class WyFileViewIcon extends LitElement {
  static override styles = [hostContentsCss];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Source file.
   */
  @property({ attribute: false })
  file?: FileType;

  /**
   * Dispatch `file-preview-loaded` when the fallback content is ready.
   *
   * @returns {boolean} True if the event was not canceled.
   */
  protected dispatchLoaded() {
    const event: FilePreviewLoadedEventType = new (CustomEvent as NamedEvent)("file-preview-loaded");
    return this.dispatchEvent(event);
  }

  override render() {
    const file = this.file;
    if (!file) return nothing;

    const { icon } = getIcon(file.name);
    const provider = getProvider(file.provider);

    return html`
      <wy-icon-display fill>
        <wy-icon name=${icon} .overlayName=${provider}></wy-icon>
        <span slot="text">
          ${provider
            ? html`
                <p>${msg("No preview available :(")} </p>
                <wy-button kind="filled" color="variant" href=${file.external_url} target="_blank"
                  >${msg(str`Open in ${provider}`)}</wy-button
                >
              `
            : html`<div>${msg("No preview available :(")}</div>`}
        </span>
      </wy-icon-display>
    `;
  }

  protected override updated(changedProperties: PropertyValues): void {
    if ((changedProperties.has("file")) && (this.file)) {
      this.dispatchLoaded();
    }
  }
}
