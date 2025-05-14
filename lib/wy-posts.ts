import { localized } from "@lit/localize";
import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyComponent } from "./classes/weavy-component";
import { AppTypeGuid } from "./types/app.types";
import { ComponentFeatures, Feature } from "./contexts/features-context";

import allStyles from "./scss/all.scss";
import colorModesStyles from "./scss/color-modes.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";
import pagerStyles from "./scss/components/pager.scss";

import "./components/base/wy-button";
import "./components/wy-empty";
import "./components/wy-notification-button-list";
import "./components/base/wy-spinner";
import "./components/wy-post-list";
import "./components/wy-context-data";
import { property } from "lit/decorators.js";

export const WY_POSTS_TAGNAME = "wy-posts";

declare global {
  interface HTMLElementTagNameMap {
    [WY_POSTS_TAGNAME]: WyPosts;
  }
}

/**
 * Weavy component to render a feed of posts.
 *
 * @element wy-posts
 * @class WyPosts
 * @extends {WeavyComponent}
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement(WY_POSTS_TAGNAME)
@localized()
export class WyPosts extends WeavyComponent {
  static override styles = [
    colorModesStyles,
    allStyles,
    hostBlockStyles,
    hostScrollYStyles,
    hostFontStyles,
    pagerStyles,
  ];

  override componentType = AppTypeGuid.Posts;

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

  protected theme = new ThemeController(this, WyPosts.styles);

  /**
   * Placeholder text for the post editor. Overrides default text.
   */
  @property()
  placeholder?: string;

  override render() {
    return html`
      <wy-buttons floating reverse>
        <wy-notification-button-list></wy-notification-button-list>
      </wy-buttons>

      <wy-post-list .placeholder=${this.placeholder}></wy-post-list>

      <wy-context-data-progress></wy-context-data-progress>
    `;
  }
}
