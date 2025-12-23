import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { html } from "lit";
import { AppTypeGuid } from "./types/app.types";
import { localized } from "@lit/localize";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { property } from "lit/decorators.js";
import { WeavyAppComponent } from "./classes/weavy-app-component";

import hostBlockCss from "./scss/host-block.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";
import colorModesCss from "./scss/color-modes.scss";

import "./components/wy-conversation";
import "./components/ui/wy-button";
import "./components/wy-context-data";

declare global {
  interface HTMLElementTagNameMap {
    "wy-chat": WyChat;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyActionEventType } from "./types/action.events"
 * @import { WyPreviewOpenEventType } from "./types/files.events"
 * @import { WyPreviewCloseEventType } from "./types/files.events"
 */

/**
 * Weavy component to render a single contextual chat.
 * 
 * **Used sub components:**
 *
 * - [`<wy-conversation>`](./components/wy-conversation.ts)
 * - [`<wy-buttons>`](./components/ui/wy-button.ts)
 * - [`<wy-context-data-progress>`](./components/wy-context-data.ts)
 *
 * @tagname wy-chat
 * @slot actions - Floating buttons placed in the top right.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an embed.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-chat")
@localized()
export class WyChat extends WeavyAppComponent {
  static override styles = [hostBlockCss, hostPaddedCss, hostScrollYCss, colorModesCss, hostFontCss];

  /** @internal */
  override appType = AppTypeGuid.Chat;

  /** @internal */
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

  /** @internal */
  protected theme = new ThemeController(this, WyChat.styles);

  /**
   * Placeholder text for the message editor.
   */
  @property()
  placeholder?: string;

  override render() {
    return html`
      <wy-buttons position="floating" reverse><slot name="actions"></slot></wy-buttons>
      <wy-conversation .conversation=${this.app} .conversationId=${this.app?.id} .placeholder=${this.placeholder}>
        <wy-context-data-progress slot="footerbar"></wy-context-data-progress>
      </wy-conversation>
    `;
  }
}
