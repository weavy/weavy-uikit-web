import { localized } from "@lit/localize";
import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { AppTypeGuid } from "./types/app.types";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { property } from "lit/decorators.js";
import { WeavyAppComponent } from "./classes/weavy-app-component";

import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-button";
import "./components/wy-post-list";
import "./components/wy-context-data";

declare global {
  interface HTMLElementTagNameMap {
    "wy-posts": WyPosts;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyLinkEventType } from "./types/notifications.events"
 * @import { WyUnreadEventType } from "./types/ui.events"
 * @import { WyActionEventType } from "./types/action.events"
 */

/**
 * Weavy component to render a feed of posts.
 * 
 * **Used sub components:**
 *
 * - [`<wy-buttons>`](./ui/wy-button.ts)
 * - [`<wy-post-list>`](./wy-post-list.ts)
 * - [`<wy-context-data-progress>`](./ui/wy-context-data.ts)
 *
 * @tagname wy-posts
 * @slot actions - Floating buttons placed in the top right.
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on an embed.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-posts")
@localized()
export class WyPosts extends WeavyAppComponent {
  static override styles = [
    colorModesCss,
    hostBlockCss,
    hostPaddedCss,
    hostScrollYCss,
    hostFontCss,
  ];

  /** @internal */
  override appType = AppTypeGuid.Posts;

  /** @internal */
  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: true,
    [Feature.CloudFiles]: true,
    [Feature.Comments]: true,
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
  protected theme = new ThemeController(this, WyPosts.styles);

  /**
   * Placeholder text for the post editor. Overrides default text.
   */
  @property()
  placeholder?: string;

  override render() {
    return html`
      <wy-buttons position="floating" reverse><slot name="actions"></slot></wy-buttons>
      <wy-post-list .placeholder=${this.placeholder}></wy-post-list>
      <wy-context-data-progress></wy-context-data-progress>
    `;
  }
}
