import { LitElement, html } from "lit";
import { customElement } from "lit/decorators.js";
import { localized } from "@lit/localize";
import { ContextualTypes } from "./types/app.types";
import { ThemeController } from "./controllers/theme-controller";
import { BlockProviderMixin } from "./mixins/block-mixin";
import { Constructor } from "./types/generic.types";
import { ProductTypes } from "./types/product.types";

import colorModesStyles from "./scss/color-modes";
import allStyles from "./scss/all";
import { blockStyles } from "./scss/block";
import { hostScrollYStyles } from "./scss/host";

import "./components/wy-comment-list";
import "./components/wy-empty";
import "./components/wy-spinner";
import "./components/wy-button";
import "./components/wy-notification-button-list";

@customElement("wy-comments")
@localized()
export class WyComments extends BlockProviderMixin(LitElement) {
  static override styles = [allStyles, blockStyles, hostScrollYStyles, colorModesStyles];

  override productType = ProductTypes.Comments;
  override contextualType = ContextualTypes.Comments;

  constructor() {
    super();
    new ThemeController(this, WyComments.styles);
  }

  override render() {
    return html`
      <wy-buttons floating reverse>
        <wy-notification-button-list></wy-notification-button-list>
      </wy-buttons>

      ${this.app && this.user
        ? html` <wy-comment-list parentId=${this.app?.id} .location=${"apps"}></wy-comment-list> `
        : html`
            <wy-empty>
              <wy-spinner padded></wy-spinner>
            </wy-empty>
          `}
    `;
  }
}

export type WyCommentsType = Constructor<WyComments>;
