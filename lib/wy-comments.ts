import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { localized } from "@lit/localize";
import { AppTypeGuid } from "./types/app.types";
import { ThemeController } from "./controllers/theme-controller";
import { WeavyComponent } from "./classes/weavy-component";
import { ComponentFeatures, Feature } from "./contexts/features-context";

import colorModesStyles from "./scss/color-modes.scss";
import allStyles from "./scss/all.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";

import "./components/wy-comment-list";
import "./components/wy-empty";
import "./components/base/wy-spinner";
import "./components/base/wy-button";
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

  override componentType = AppTypeGuid.Comments;
  
  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: true,
    [Feature.CloudFiles]: true,
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

  protected theme = new ThemeController(this, WyComments.styles);

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
