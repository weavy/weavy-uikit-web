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
 * Weavy chat component to render a single contextual conversation.
 *
 * The conversation can show rich messages with markdown formatting including code syntax highlight.
 * Messages can have uploaded images, attached files and cloud files with full browser preview of 100+ formats.
 * Polls, video meetings, rich link embeds, tags and mentions can be used in messages.
 * Users can react with predefined emojis to each message.
 *
 * The editor features markdown preview, including code syntax highlighting.
 * It has buttons for adding polls, video meetings, images, files and cloud files.
 * Mentions brings up a user selector.
 * Drafts are automatically saved for each conversation.
 *
 * Each chat component requires an app identifier (`uid`), which automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's also recommended to specify a readable `name` of the chat, to get better readable notifications from the app.
 *
 * > It's often useful to base the `uid` on something that identifies the location where the component is rendered.
 * > Typically you would use something like a product id, page id or path.
 *
 * > Complement this with the [`<wy-notification-toasts>`](./wy-notification-toasts.ts) component to also get realtime _in-app notifications_ or _browser notifications_ when new messages arrive.
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
 *
 * @example <caption>Standard chat</caption>
 *
 * Displays a conversation, placed in a container using a flex layout which the component adapts to. Authenticated users with access to the component will be added as members in the conversation.
 *
 * Specifying the app identifier (`uid`) is required, and automatically creates a [corresponding app](https://www.weavy.com/docs/concepts#app) on your Weavy environment when the component is first initialized.
 * It's recommended to specify a readable `name` of the chat app, to get better readable notifications from the app.
 *
 * ```html
 * <div style="display: flex; height: 100%;">
 *   <wy-chat uid="test-chat" name="Test chat"></wy-chat>
 * </div>
 * ```
 *
 * @example <caption>Chat with instructions and contextual data</caption>
 *
 * Any agents added to the chat using the [Web API](https://www.weavy.com/docs/reference/api) gets much more useful if they know about the data and content on your page. You can update this anytime you like to keep it up-to-date. Here we provide data from the DOM to the agent using the `contextualData` property.
 *
 * ```html
 * <div id="my-sample-content">
 *   <h1>ACME</h1>
 *   <ul>
 *     <li>Wile E. Coyote</li>
 *     <li>Daffy Duck</li>
 *     <li>Porky Pig</li>
 *   </ul>
 * </div>
 *
 * <wy-chat uid="test-chat" name="Test chat"></wy-chat>
 *
 * <script>
 *   const myContent = document.querySelector("#my-sample-content");
 *   const chat = document.querySelector("wy-chat");
 *   chat.contextualData = myContent.innerHTML;
 * </script>
 * ```
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
   * Optional agent instructions appended to submitted messages.
   */
  @property()
  instructions?: string;

  /**
   * Placeholder text for the message editor.
   */
  @property()
  placeholder?: string;

  override render() {
    return html`
      <wy-buttons position="floating" reverse><slot name="actions"></slot></wy-buttons>
      <wy-conversation
        .agentInstructions=${this.instructions}
        .conversation=${this.app}
        .conversationId=${this.app?.id}
        .placeholder=${this.placeholder}
      >
        <wy-context-data-progress slot="footerbar"></wy-context-data-progress>
      </wy-conversation>
    `;
  }
}
