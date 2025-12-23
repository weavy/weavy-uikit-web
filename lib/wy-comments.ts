import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { localized } from "@lit/localize";
import { AppTypeGuid } from "./types/app.types";
import { ThemeController } from "./controllers/theme-controller";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { property } from "lit/decorators.js";
import { WeavyAppComponent } from "./classes/weavy-app-component";

import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";
import commentsCss from "./scss/components/comments.scss";

import "./components/wy-comment-list";
import "./components/ui/wy-button";
import "./components/wy-context-data";

declare global {
  interface HTMLElementTagNameMap {
    "wy-comments": WyComments;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyActionEventType } from "./types/action.events"
 * @import { WyPreviewOpenEventType } from "./types/files.events"
 * @import { WyPreviewCloseEventType } from "./types/files.events"
 */

/**
 * Weavy component to render contextual comments.
 * 
 * **Used sub components:**
 *
 * - [`<wy-comment-list>`](./components/wy-comment-list.ts)
 * - [`<wy-buttons>`](./components/ui/wy-button.ts)
 * - [`<wy-context-data-progress>`](./components/wy-context-data.ts)
 *
 * @tagname wy-comments
 * @slot actions - Floating buttons placed in the top right.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an embed.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-comments")
@localized()
export class WyComments extends WeavyAppComponent {
  static override styles = [hostBlockCss, hostPaddedCss, hostScrollYCss, colorModesCss, hostFontCss, commentsCss];

  /** @internal */
  override appType = AppTypeGuid.Comments;

  /** @internal */
  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: true,
    [Feature.CloudFiles]: true,
    [Feature.ContextData]: true,
    [Feature.Embeds]: true,
    [Feature.GoogleMeet]: false,
    [Feature.Meetings]: false,
    [Feature.Mentions]: true,
    [Feature.MicrosoftTeams]: false,
    [Feature.Polls]: true,
    [Feature.Previews]: true,
    [Feature.Reactions]: true,
    [Feature.Typing]: false, // Has no effect currently
    [Feature.ZoomMeetings]: false,
  });

  /** @internal */
  protected theme = new ThemeController(this, WyComments.styles);

  /**
   * Placeholder text for the comment editor. Overrides default text.
   */
  @property()
  placeholder?: string;

  override render() {
    return html`
      <wy-buttons position="floating" reverse><slot name="actions"></slot></wy-buttons>
      <wy-comment-list .parentId=${this.app?.id} .location=${"apps"} .placeholder=${this.placeholder}></wy-comment-list>
      <wy-context-data-progress></wy-context-data-progress>
    `;
  }
}
