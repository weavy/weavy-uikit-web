import { html } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { property } from "lit/decorators.js";

import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-button";
import "./components/wy-post-form";
import { WeavyAppComponent } from "./classes/weavy-app-component";
import { AppTypeGuid } from "./types/app.types";

declare global {
  interface HTMLElementTagNameMap {
    "wy-post-editor": WyPostEditor;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 */

/**
 * Posts editor component to create posts in specific post apps. This component _does not_ render the feed itself, but can be used together with `<wy-posts>` to build a complete feed with post creation capabilities.
 *
 * The component is a rich post editor with built in support for markdown, code formatting, images, file attachments, cloud attachments, mentions, links, embeds, and polls.
 *
 * The post editor needs the app identifier (`uid`) of a single post app or a space separated string of multiple uid:s for pre-created post apps that the user can choose from. Specifying only one uid allows automatic creation of a [corresponding post app](xref:concepts#app) on the server the first time it's accessed. When using multiple uid:s, all the specified post apps must exist prior to loading the editor.
 *
 * > It's often useful to base the `uid` on something that identifies the location where the component is rendered.
 * > Typically you would use something like a product id, page id, or path.
 * 
 * This component is great if you want to decouple the [`<wy-posts>`](./wy-posts.ts) feed from the editor, for instance to place the editor in a different part of the screen or to use the feed without an editor.
 *
 * **Component Layout**
 *
 * The component is [block-level](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content) with pre-defined CSS styling to adapt well to flex- and grid-layouts as well as traditional flow-layouts.
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
 * - [`<wy-post-form>`](./wy-post-form.ts)
 *
 * @tagname wy-post-editor
 * @slot actions - Extra buttons.
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 *
 * @example <caption>Post editor for a posts app</caption>
 *
 * Display a post editor that posts to a specific posts app.
 * 
 * Specifying the app identifier (`uid`) is required, and automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's recommended to specify a readable `name` of the posts app, to get better readable notifications from the app.
 *
 * ```html
 * <wy-post-editor uid="test-posts" name="Test feed"></wy-post-editor>
 * ```
 * 
 * @example <caption>Post editor for multiple posts apps</caption>
 *
 * Display a post editor that has a selector for choosing a predefined post app to post to.
 * 
 * Specifying more than one app identifier (`uid`) separated by space is required.
 *
 * ```html
 * <wy-post-editor uid="test-posts test-news"></wy-post-editor>
 * ```
 */
@customElement("wy-post-editor")
export class WyPostEditor extends WeavyAppComponent {
  static override styles = [colorModesCss, hostBlockCss, hostPaddedCss, hostFontCss];

  /** @internal */
  override appType = AppTypeGuid.Posts;

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
    [Feature.ZoomMeetings]: false,
  });

  /**
   * Disabled link matching/consuming.
   * @internal
   */
  override matchesLink(): boolean {
    return false;
  }

  /** @internal */
  protected theme = new ThemeController(this, WyPostEditor.styles);

  /**
   * Placeholder text for the post editor. Overrides default text.
   */
  @property()
  placeholder?: string;

  override render() {
    return html`
      <wy-post-form .placeholder=${this.placeholder}>
        <slot name="actions" slot="actions"></slot>
      </wy-post-form>
    `;
  }
}
