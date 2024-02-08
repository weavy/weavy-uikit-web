import { LitElement, css, html } from "lit";
import { customElement, property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";

import "./wy-spinner";

import allCss from "../scss/all.scss";

import { checkImageLoad, imageLoaded } from "../utils/images";

@customElement("wy-preview-image")
@localized()
export class WyPreviewImage extends LitElement {
  
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

  @property({ type: Number })
  width?: number;

  @property({ type: Number })
  height?: number;

  override render() {
    if (this.width && this.height) {
      const imageStyles = { ["--width"]: this.width, ["--height"]: this.height };
      return html`
        <div class="wy-content-image wy-responsive-image" style=${styleMap(imageStyles)}>
          <img
            class="wy-loading-transition"
            src=${this.src}
            ${ref(checkImageLoad)}
            @load=${imageLoaded}
            width=${this.width}
            height=${this.height}
            decoding="async"
            alt=${msg("Preview")} />
          <wy-spinner></wy-spinner>
        </div>
      `;
    } else {
      return html`
        <div class="wy-content-image wy-responsive-image wy-intrinsic-image">
          <img src=${this.src} ${ref(checkImageLoad)} @load=${imageLoaded} decoding="async" alt=${msg("Preview")} />
        </div>
      `;
    }
  }
}
