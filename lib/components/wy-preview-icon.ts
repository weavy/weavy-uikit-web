import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { localized, msg, str } from "@lit/localize";

import "./wy-icon";

import allCss from "../scss/all.scss";
import { getProvider } from "../utils/files";

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

  @property()
  src!: string;

  @property()
  icon!: string;

  @property()
  provider?: string;

  @property()
  iconClass?: string;

  override render() {
    let icon = this.icon;
    const provider = getProvider(this.provider);

    if (provider) {
      icon = `${icon}+${provider}`;
    }
    return html`
      <div class="wy-content-icon ${this.iconClass ?? ""}">
        <div class="wy-content-icon">
          <wy-icon name=${icon}></wy-icon>
        </div>
        <div class="wy-content-name">
          ${this.provider
            ? html`
                <span>${msg("No preview available :(")} </span>
                <a href=${this.src} target="_blank">${msg(str`Open in ${this.provider}?`)}</a>
              `
            : html`<span>${msg("No preview available :(")}</span>`}
        </div>
      </div>
    `;
  }
}
