import { customElement } from "lit/decorators.js";
import { ThemeController } from "./controllers/theme-controller";
import { LitElement, html } from "lit";
import { ContextualTypes } from "./types/app.types";
import { ConversationType } from "./types/conversations.types";
import { BlockProviderMixin } from "./mixins/block-mixin";
import { Constructor } from "./types/generic.types";
import { ProductTypes } from "./types/product.types";
import { localized } from "@lit/localize";

import allStyles from "./scss/all.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";
import colorModesStyles from "./scss/color-modes.scss";

import "./components/wy-conversation";
import "./components/wy-notification-button-list";
import "./components/wy-empty";
import "./components/wy-button";
import "./components/wy-spinner";

@customElement("wy-chat")
@localized()
export class WyChat extends BlockProviderMixin(LitElement) {
  static override styles = [allStyles, hostBlockStyles, hostScrollYStyles, colorModesStyles, hostFontStyles];

  override productType = ProductTypes.Chat;
  override contextualType = ContextualTypes.Chat;

  // Override app type
  override get app() {
    return super.app as ConversationType;
  }

  override set app(app: ConversationType) {
    super.app = app;
  }

  constructor() {
    super();
    new ThemeController(this, WyChat.styles);
  }

  override render() {
    return html`
      <wy-buttons floating reverse>
        <wy-notification-button-list></wy-notification-button-list>
      </wy-buttons>

      ${this.app
        ? html` <wy-conversation .conversation=${this.app} .conversationId=${this.app.id}></wy-conversation> `
        : html` <wy-empty><wy-spinner></wy-spinner></wy-empty> `}
    `;
  }
}

export type WyChatType = Constructor<WyChat>;
