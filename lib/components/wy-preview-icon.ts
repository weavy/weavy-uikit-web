import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { localized, msg, str } from "@lit/localize";
import { getProvider } from "../utils/files";
import type { FileProviderType } from "../types/files.types";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import type { iconNamesType } from "../utils/icons";

import "./wy-icon";

import allCss from "../scss/all"

@customElement("wy-preview-icon")
@localized()
export class WyPreviewIcon extends LitElement {
  
  static override styles = [
    allCss,
    css`
      :host {
        display: contents;
      }
      `,
  ];
  
  protected exportParts = new ShadowPartsController(this);
  
  @property()
  src!: string;

  @property()
  icon!: iconNamesType;

  @property()
  provider?: FileProviderType;

  override render() {
    const icon = this.icon;
    const provider = getProvider(this.provider);

    return html`
      <wy-icon-display>
        <wy-icon name=${icon} .overlayName=${provider}></wy-icon>
        <span slot="text">
          ${this.provider
            ? html`
                <span>${msg("No preview available :(")} </span>
                <a href=${this.src} target="_blank">${msg(str`Open in ${this.provider}?`)}</a>
              `
            : html`<span>${msg("No preview available :(")}</span>`}
        </span>
      </wy-icon-display>
    `;
  }
}
