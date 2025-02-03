import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { html } from "lit";
import { AppTypeString } from "./types/app.types";
import { WeavyComponent } from "./classes/weavy-component";
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

export const WY_CHAT_TAGNAME = "wy-chat";

declare global {
  interface HTMLElementTagNameMap {
    [WY_CHAT_TAGNAME]: WyChat;
  }
}

/**
 * Weavy component to render a single contextual chat.
 *
 * @element wy-chat
 * @class WyChat
 * @fires wy-preview-open {WyPreviewOpenEventType}
 * @fires wy-preview-close {WyPreviewCloseEventType}
 */
@customElement(WY_CHAT_TAGNAME)
@localized()
export class WyChat extends WeavyComponent {
  static override styles = [allStyles, hostBlockStyles, hostScrollYStyles, colorModesStyles, hostFontStyles];

  override productType = ProductTypes.Chat;
  override componentType = AppTypeString.Chat;

  constructor() {
    super();
    new ThemeController(this, WyChat.styles);
  }

  override render() {
    return this.app
      ? html`
          <wy-buttons floating reverse>
            <wy-notification-button-list></wy-notification-button-list>
          </wy-buttons>
          <wy-conversation .conversation=${this.app} .conversationId=${this.app.id}></wy-conversation>
        `
      : html` <wy-empty><wy-spinner padded reveal></wy-spinner></wy-empty> `;
  }
}
