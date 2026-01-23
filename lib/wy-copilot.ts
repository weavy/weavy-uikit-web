import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { html, PropertyValues } from "lit";
import { AppTypeGuid, AppTypeString } from "./types/app.types";
import { WeavyAppComponent } from "./classes/weavy-app-component";
import { localized, msg } from "@lit/localize";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { property } from "lit/decorators.js";
import { CreateAppMutationType, getCreateAppMutation } from "./data/app";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { v4 as uuid_v4 } from "uuid";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "./utils/keyboard";
import { getTitleFromText, truncateText } from "./utils/strings";
import { triggerMessageEvent } from "./realtime/messages.realtime";
import { WeavyComponentAgentProps } from "./types/agent.types";
import { WyConversation } from "./components/wy-conversation";

import hostBlockCss from "./scss/host-block.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";
import hostFontCss from "./scss/host-font.scss";
import colorModesCss from "./scss/color-modes.scss";

import "./components/ui/wy-button";
import "./components/ui/wy-icon";
import "./components/ui/wy-item";
import "./components/wy-empty";
import "./components/wy-context-data";
import "./components/wy-conversation";

declare global {
  interface HTMLElementTagNameMap {
    "wy-copilot": WyCopilot;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyActionEventType } from "./types/action.events"
 * @import { WyPreviewOpenEventType } from "./types/files.events"
 * @import { WyPreviewCloseEventType } from "./types/files.events"
 */

/**
 * Weavy copilot component to render single, contextual and personal chats with an AI agent.
 *
 * It needs to be [configured with an AI agent](https://www.weavy.com/docs/learn/integrations/agent) and can have custom _instructions_ and use any _contextual data_ you provide (as long as it's a string). 
 * To get started, you can use Weavy's built-in `"assistant"` agent.
 *
 * The copilot chat is agent-to-user which means each user has their own chat with the agent. 
 * Each time the copilot component is loaded a fresh chat is started.
 * A fresh conversation can be started at any time by using the `.reset()` method.
 * The component can optionally be configured with a `uid` to persist the conversation. 
 * 
 * > If you specify a `uid` it needs to be unique per _user_ and _agent_ (if you intend to use several agents).
 * > For ease-of-use, you can do this automatically by specifying the `generateUid` property instead of the `uid` property.
 * > It's optional to provide a uid and in many cases not needed. 
 * > When using a uid it's often useful to base the uid on something that identifies the location where the component is rendered. 
 * > Typically you would use something like a product id, page id or path.
 *
 * Predefined elements with the `suggestion` class can be placed in the `suggestion-list` slot to create text hints for the user on what to do.
 * When clicked, the suggestion text gets automatically placed in the message editor.
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
 * - [`<wy-comment-list>`](./components/wy-comment-list.ts)
 * - [`<wy-buttons>`](./components/ui/wy-button.ts)
 * - [`<wy-item-list>`](./components/ui/wy-item.ts)
 * - [`<wy-empty>`](./components/ui/wy-empty.ts)
 * - [`<wy-icon>`](./components/ui/wy-icon.ts)
 * - [`<wy-icon-display>`](./components/ui/wy-icon.ts)
 * - [`<wy-context-data-progress>`](./components/wy-context-data.ts)
 *
 * @tagname wy-copilot
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyActionEventType} wy-action - Emitted when an action is performed on a conversation or embed.
 * @fires {WyMessageEventType} wy-message - Fired when a message has been appended to the conversation.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 *
 * @slot actions - Floating buttons placed in the top right.
 * @slot empty - All the content for the empty state.
 * @slot header - Header for the `empty` state.
 * @slot icon - Display icon in the `header`.
 * @slot suggestions - Suggestion content in the `empty` state.
 * @slot suggestion-list - Items for the list in the `suggestion` content.
 * @slot footer - Footer for the `empty` state.
 *
 * @example <caption>Generic AI copilot chat</caption>
 * 
 * Displays a chat based AI copilot, placed in a container using a flex layout which the component adapts to. 
 * 
 * The `agent` property is required and should correspond to [agent](https://www.weavy.com/docs/learn/integrations/agents) in your environment. 
 * You may switch between agents whenever you like, but remember that the conversation also changes.
 *
 * Here we use the built-in agent with uid `assistant`.
 *
 * ```html
 * <div style="display: flex; height: 100%;">
 *   <wy-copilot agent="assistant"></wy-copilot>
 * </div>
 * ```
 *
 * @example <caption>Copilot with instructions and contextual data</caption>
 * 
 * The copilot gets much more useful if it knows about the data and content on your page. 
 * You can update this anytime you like to keep it up-to-date.
 * Here we provide data from the DOM to the agent using the `contextualData` property.
 * 
 * ```html
 * <div id="my-sample-content">
 *  <h1>ACME</h1>
 *  <ul>
 *    <li>Wile E. Coyote</li>
 *    <li>Daffy Duck</li>
 *    <li>Porky Pig</li>
 *  </ul>
 * </div>
 *
 * <wy-copilot id="my-copilot" agent="assistant"></wy-copilot>
 *
 * <script>
 *  const copilot = document.querySelector("#my-copilot");
 *  const sampleContent = document.querySelector("#my-sample-content");
 *
 *  copilot.instructions = "Answer in a whacky way with many emojis.";
 *  copilot.data = [sampleContent.innerHTML];
 * </script>
 * ```
 *
 * @example <caption>Copilot with a custom button and suggestions</caption>
 * You may use slots to provide custom functionality to the copilot. This example shows a button to reset the conversation and some custom suggestions.
 *
 * When the suggestions have the `.suggestion` class, they automatically get their text inserted into the editor when clicked.
 *
 * In this example we use the pre-styled weavy sub components, but you may use any elements or components you like.
 *
 * ```html
 * <wy-copilot id="my-copilot" agent="assistant">
 *   <wy-button
 *     slot="actions"
 *     kind="icon"
 *     onclick="document.querySelector('#my-copilot').reset()"
 *   >
 *     <wy-icon name="stars"></wy-icon>
 *   </wy-button>
 *
 *   <wy-button slot="suggestion-list" class="suggestion">Summarize this page</wy-button>
 *   <wy-button slot="suggestion-list" class="suggestion">What keywords are used?</wy-button>
 * </wy-copilot>
 * ```
 *
 * @example <caption>Preventing child nodes from flashing during load</caption>
 *
 * To prevent child nodes from rendering before the component has loaded you can hide them using CSS.
 *
 * ```css
 * wy-copilot:not(:defined) { display: none; }
 * ```
 */
@customElement("wy-copilot")
@localized()
export class WyCopilot extends WeavyAppComponent implements WeavyComponentAgentProps {
  static override styles = [hostBlockCss, hostPaddedCss, hostScrollYCss, colorModesCss, hostFontCss];

  /** @internal */
  override appType = AppTypeGuid.AgentChat;

  /** @internal */
  override componentFeatures = new ComponentFeatures({
    // All available features as enabled/disabled by default
    [Feature.Attachments]: false,
    [Feature.ContextData]: true,
    [Feature.Embeds]: true,
    [Feature.Mentions]: false,
    [Feature.Previews]: true,
    [Feature.Reactions]: false,
    [Feature.Typing]: true,
  });

  /** @internal */
  protected theme = new ThemeController(this, WyCopilot.styles);

  /** @internal */
  protected addConversationMutation?: CreateAppMutationType;

  /** @internal */
  protected conversationRef: Ref<WyConversation> = createRef();

  /** @internal */
  protected handleRealtimeMessage = triggerMessageEvent.bind(this);

  /** @internal */
  protected unsubscribeToRealtime?: () => void;

  /**
   * Optional agent instructions appended to submitted messages.
   */
  @property()
  instructions?: string;

  /**
   * Placeholder text for the message editor. Overrides default text.
   */
  @property()
  placeholder?: string;

  /**
   * Sets the editor input to a suggested text. This replaces the text content of the editor. This can be used to create any custom suggestions.
   *
   * @param {string} text - The text suggestion to place in the editor.
   */
  async setSuggestion(text: string) {
    await this.conversationRef.value?.setEditorText(text);
  }

  protected override async willUpdate(changedProperties: PropertyValues): Promise<void> {
    await super.willUpdate(changedProperties);

    if (changedProperties.has("weavy") && this.weavy) {
      this.addConversationMutation = getCreateAppMutation(this.weavy);
    }

    if ((changedProperties.has("app") || changedProperties.has("weavy")) && this.weavy) {
      this.unsubscribeToRealtime?.();

      if (this.app) {
        const subscribeGroup = `a${this.app.id}`;

        void this.weavy.subscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);

        this.unsubscribeToRealtime = () => {
          void this.weavy?.unsubscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
          this.unsubscribeToRealtime = undefined;
        };
      }
    }

    if (changedProperties.has("agent") && changedProperties.get("agent") && this.agent) {
      this.reset();
    }
  }

  override render() {
    return this.agent
      ? html`
          <wy-buttons position="floating" reverse>
            <slot name="actions"></slot>
          </wy-buttons>
          <wy-conversation
            ${ref(this.conversationRef)}
            .conversation=${this.app}
            .conversationId=${this.app?.id}
            .placeholder=${this.placeholder ?? msg("Ask anything...")}
            .agentInstructions=${this.instructions}
            .createConversation=${this.agent && this.addConversationMutation
              ? async (payload: Parameters<NonNullable<WyConversation["createConversation"]>>[0]) => {
                  if (!this.agent || !this.addConversationMutation) {
                    throw new Error("Agent or addConversationMutation not defined");
                  }
                  const conversationOptions = {
                    uid: `wy-copilot-${uuid_v4()}`,
                    name: truncateText(getTitleFromText(this.name ?? payload.text)),
                    members: [this.agent],
                    type: AppTypeString.AgentChat,
                  };

                  // App-create-event here?

                  const conversation = await this.addConversationMutation.mutate(conversationOptions);
                  this.app = conversation;
                  await this.updateComplete;

                  // App-created-event here?

                  return conversation;
                }
              : undefined}
          >
            <slot
              slot="empty"
              name="empty"
              @click=${async (e: MouseEvent) => {
                if ((e.target as HTMLElement).matches(".suggestion")) {
                  e.stopPropagation();
                  await this.setSuggestion((e.target as HTMLElement).innerText);
                  //await this.conversationRef.value?.selectAllInEditor();
                  await this.conversationRef.value?.setCursorLastInEditor();
                  this.conversationRef.value?.focusEditor();
                }
              }}
              @keydown=${clickOnEnterAndConsumeOnSpace}
              @keyup=${clickOnSpace}
            >
              <slot name="header">
                <wy-icon-display>
                  <slot name="icon">
                    <wy-icon name="stars"></wy-icon>
                  </slot>
                </wy-icon-display>
              </slot>
              <slot name="suggestions">
                <wy-item-list>
                  <slot name="suggestion-list">
                    <!--wy-button class="suggestion">Summarize this page</wy-button-->
                  </slot>
                </wy-item-list>
              </slot>
              <slot name="footer"></slot>
            </slot>
            <wy-context-data-progress slot="footerbar"></wy-context-data-progress>
          </wy-conversation>
        `
      : html`
          <wy-empty>
            <wy-icon-display>
              <slot name="icon">
                <wy-icon name="stars"></wy-icon>
              </slot>
            </wy-icon-display>
          </wy-empty>
        `;
  }
}
