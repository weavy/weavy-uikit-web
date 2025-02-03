import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { localized } from "@lit/localize";
import { AppTypeString } from "./types/app.types";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyComponent } from "./classes/weavy-component";
import { ProductTypes } from "./types/product.types";

import colorModesStyles from "./scss/color-modes.scss";
import allStyles from "./scss/all.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";

import "./components/wy-comment-list";
import "./components/wy-empty";
import "./components/wy-spinner";
import "./components/wy-button";
import "./components/wy-notification-button-list";

export const WY_COMMENTS_TAGNAME = "wy-comments";

declare global {
  interface HTMLElementTagNameMap {
    [WY_COMMENTS_TAGNAME]: WyComments;
  }
}

/**
 * Weavy component to render contextual comments.
 *
 * @element wy-comments
 * @class WyComments
 * @fires wy-preview-open {WyPreviewOpenEventType}
 * @fires wy-preview-close {WyPreviewCloseEventType}
 */
@customElement(WY_COMMENTS_TAGNAME)
@localized()
export class WyComments extends WeavyComponent {
  static override styles = [allStyles, hostBlockStyles, hostScrollYStyles, colorModesStyles, hostFontStyles];

  override productType = ProductTypes.Comments;
  override componentType = AppTypeString.Comments;

  constructor() {
    super();
    new ThemeController(this, WyComments.styles);
  }

  override render() {
    return this.app
      ? html`
          <wy-buttons floating reverse>
            <wy-notification-button-list></wy-notification-button-list>
          </wy-buttons>
          <wy-comment-list parentId=${this.app.id} .location=${"apps"}></wy-comment-list>
        `
      : html`
          <wy-empty>
            <wy-spinner padded reveal></wy-spinner>
          </wy-empty>
        `;
  }
}
