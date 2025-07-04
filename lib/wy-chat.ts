import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { html } from "lit";
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
import "./components/base/wy-button";
import "./components/wy-context-data";
import { property } from "lit/decorators.js";

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
 * @extends {WeavyComponent}
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement(WY_CHAT_TAGNAME)
@localized()
export class WyChat extends WeavyComponent {
  static override styles = [allStyles, hostBlockStyles, hostScrollYStyles, colorModesStyles, hostFontStyles];

  override componentType = AppTypeGuid.Chat;

  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: true,
    [Feature.ContextData]: true,
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

  /**
   * Placeholder text for the message editor. Overrides default text.
   */
  @property()
  placeholder?: string;

  override render() {
    return html`
      <wy-context-data-progress></wy-context-data-progress>
      <wy-buttons position="floating" reverse>
        <wy-notification-button-list></wy-notification-button-list>
      </wy-buttons>

      <wy-conversation .conversation=${this.app} .conversationId=${this.app?.id} .placeholder=${this.placeholder}>
        <wy-context-data-progress slot="footerbar"></wy-context-data-progress>
      </wy-conversation>
    `;
  }
}
