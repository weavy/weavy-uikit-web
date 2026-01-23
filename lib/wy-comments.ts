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
 * Weavy comments component to render a list of comments next to something like a product, page, blog post etc.
 *
 * The comment list can show rich comments with markdown formatting including code syntax highlight. Comments can have uploaded images, attached files and cloud files with full browser preview of 100+ formats. Polls, video meetings, rich link embeds, tags and mentions can be used, and users can react with predefined emojis to each comment.
 *
 * The editor features markdown preview, including code syntax highlighting. It has buttons for adding polls, video meetings, images, files and cloud files. Mentions brings up a user selector. Drafts are automatically saved for each comment list.
 *
 * Each comments component requires an app identifier (`uid`), which automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized. It's also recommended to specify a readable `name` of the comment list, to get better readable notifications from the app. It's often useful to base the `uid` on something that identifies the location where the component is rendered. Typically you would use something like a product id, page id or path.
 *
 * **Component Layout**
 *
 * The component is [block-level](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content) with pre-defined CSS styling to adapt to flex- and grid-layouts as well as traditional flow-layouts.
 * It's usually recommended to use a proper flex-layout for the container you are placing the component in for a smooth layout integration.
 *
 * The height grows with the content per default. Content is automatically loaded during scrolling when the last content becomes visible (aka infinite scrolling).
 * If placed in a flex- or grid-layout or if an explicit height is set, the component becomes scrollable.
 *
 * The content within the components is per default aligned to the edges of it's own _box_ and designed to not be placed next to a edge or border.
 * It's recommended to adjust the layout with your default padding. Setting the `--wy-padding-outer` to your default padding will allow the component to still fill the are where it's placed,
 * but with proper padding within the scrollable area of the component.
 * If you want to make the component go all the way to the edges without padding or any outermost roundness instead,
 * set `--wy-padding-outer: 0;` and `--wy-border-radius-outer: 0;` to make the component fit nicely with the edge.
 *
 * You can add additional styling using _CSS Custom Properties_ and _CSS Shadow Parts_ and further customization using _slots_.
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
 *
 * @example <caption>Standard comment list</caption>
 *
 * Displays a comment list beneath a subject item.
 *
 * Specifying the app identifier (`uid`) is required, and automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's recommended to specify a readable `name` of the chat app, to get better readable notifications from the app.
 *
 * ```html
 * <div>
 *   <h2>My subject</h2>
 *   <p>Some details about the subject</p>
 * </div>
 * <wy-comments uid="my-subject-comments" name="Subject comments"></wy-comments>
 * ```
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
