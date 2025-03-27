import { LitElement, html } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { styleMap } from "lit/directives/style-map.js";
import { ref } from "lit/directives/ref.js";
import { localized, msg } from "@lit/localize";
import { checkImageLoad, imageLoaded } from "../utils/images";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import allCss from "../scss/all.scss"
import hostContentsCss from "../scss/host-contents.scss";

import "./base/wy-spinner";

@customElement("wy-preview-image")
@localized()
export class WyPreviewImage extends LitElement {
  
  static override styles = [
    allCss,
    hostContentsCss,
  ];

  protected exportParts = new ShadowPartsController(this);

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
