import { LitElement, PropertyValues, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { localized, msg, str } from "@lit/localize";
import { getProvider } from "../utils/files";
import type { FileProviderType } from "../types/files.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { iconNamesType } from "../utils/icons";
import type { FilePreviewLoadedEventType } from "../types/files.events";
import type { NamedEvent } from "../types/generic.types";

import hostContentsCss from "../scss/host-contents.scss";

import "./ui/wy-icon";
import "./ui/wy-button";

declare global {
  interface HTMLElementTagNameMap {
    "wy-preview-icon": WyPreviewIcon;
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
@customElement("wy-preview-icon")
@localized()
export class WyPreviewIcon extends LitElement {
  
  static override styles = [
    hostContentsCss,
  ];
  
  /** @internal */
  protected exportParts = new ShadowPartsController(this);
  
  /**
   * Source URL used when opening the original content.
   */
  @property()
  src!: string;

  /**
   * Icon name representing the preview.
   */
  @property()
  icon!: iconNamesType;

  /**
   * File provider metadata that decorates the preview.
   */
  @property()
  provider?: FileProviderType;

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
    const icon = this.icon;
    const provider = getProvider(this.provider);

    return html`
      <wy-icon-display fill>
        <wy-icon name=${icon} .overlayName=${provider}></wy-icon>
        <span slot="text">
          ${this.provider
            ? html`
                <p>${msg("No preview available :(")} </p>
                <wy-button kind="filled" color="variant" href=${this.src} target="_blank">${msg(str`Open in ${this.provider}`)}</wy-button>
              `
            : html`<div>${msg("No preview available :(")}</div>`}
        </span>
      </wy-icon-display>
    `;
  }

  protected override updated(changedProperties: PropertyValues): void {
    if ((changedProperties.has("icon") || changedProperties.has("src")) && (this.icon || this.src)) {
      this.dispatchLoaded();
    }
  }
}
