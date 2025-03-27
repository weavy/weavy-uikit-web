import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { html, nothing } from "lit";
import { AppTypeGuid } from "./types/app.types";
import { WeavyComponent } from "./classes/weavy-component";
import { localized } from "@lit/localize";
import { ComponentFeatures, Feature } from "./contexts/features-context";

import allStyles from "./scss/all.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";
import colorModesStyles from "./scss/color-modes.scss";

import "./components/wy-conversation";
import "./components/wy-notification-button-list";
import "./components/wy-empty";
import "./components/base/wy-button";
import "./components/base/wy-spinner";

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

  override componentType = AppTypeGuid.Chat;

  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: true,
    [Feature.CloudFiles]: true,
    [Feature.Embeds]: true,
    [Feature.GoogleMeet]: true,
    [Feature.Meetings]: true,
    [Feature.Mentions]: true,
    [Feature.MicrosoftTeams]: true,
    [Feature.Polls]: true,
    [Feature.Previews]: true,
    [Feature.Reactions]: true,
    [Feature.Receipts]: false,
    [Feature.Typing]: false,
    [Feature.ZoomMeetings]: true,
  });

  protected theme = new ThemeController(this, WyChat.styles);

  override render() {
    return html`
      ${this.app
        ? html`
            <wy-buttons floating reverse>
              <wy-notification-button-list></wy-notification-button-list>
            </wy-buttons>
          `
        : nothing}

      <wy-conversation .conversation=${this.app} .conversationId=${this.app?.id}></wy-conversation>
    `;
  }
}
