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
 * Weavy posts component to render a feed of posts and comments as seen on many social networks.
 *
 * The component includes a rich post editor with built in support for markdown, code formatting, images, file attachments, cloud attachments, mentions, links, embeds, and polls.
 *
 * Posts are composed with a header containing author information an an avatar.
 * The rich content of a post is built up from user markdown text, images, polls, embeds, links, audio, video, file attachments, and cloud files.
 * Each post can be reacted to with a set of emoji reactions and commented to using rich comments.
 *
 * Images, audio, video, attached files, and cloud files can be previewed with the built-in previewer supporting 100+ file formats including PDF, Office and Google Drive.
 *
 * Each post feed requires an app identifier (`uid`), which automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's also recommended to specify a readable `name` of the posts app, to get better readable notifications from the app.
 * 
 * > It's often useful to base the `uid` on something that identifies the location where the component is rendered.
 * > Typically you would use something like a product id, page id, or path.
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
 * 
 * @example <caption>Standard posts feed with editor</caption>
 * 
 * Display a post feed with an post editor at the top. 
 * Specifying the app identifier (`uid`) is required, and automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's recommended to specify a readable `name` of the posts app, to get better readable notifications from the app.
 * 
 * ```html
 * <wy-posts uid="test-posts" name="Test feed"></wy-posts>
 * ```
 */
@customElement("wy-posts")
@localized()
export class WyPosts extends WeavyAppComponent {
  static override styles = [colorModesCss, hostBlockCss, hostPaddedCss, hostScrollYCss, hostFontCss];

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
