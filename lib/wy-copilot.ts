import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { html, nothing, PropertyValues } from "lit";
import { AppTypeGuid, AppTypeString } from "./types/app.types";
import { WeavyComponent } from "./classes/weavy-component";
import { localized, msg } from "@lit/localize";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { property } from "lit/decorators.js";
import { CreateAppMutationType, getCreateAppMutation } from "./data/app";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { v4 as uuid_v4 } from "uuid";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "./utils/keyboard";
import { getTitleFromText, truncateText } from "./utils/strings";
import { handleRealtimeMessage } from "./realtime/messages.realtime";
import { WeavyComponentAgentProps } from "./types/agent.types";

import hostBlockStyles from "./scss/host-block.scss";
import hostScrollYStyles from "./scss/host-scroll-y.scss";
import hostFontStyles from "./scss/host-font.scss";
import colorModesStyles from "./scss/color-modes.scss";
import listStyles from "./scss/components/list.scss";

import { WyConversation } from "./components/wy-conversation";
import "./components/wy-notification-button-list";
import "./components/wy-empty";
import "./components/base/wy-button";
import "./components/base/wy-spinner";
import "./components/base/wy-icon";
import "./components/wy-context-data";

export const WY_COPILOT_TAGNAME = "wy-copilot";

declare global {
  interface HTMLElementTagNameMap {
    [WY_COPILOT_TAGNAME]: WyCopilot;
  }
}

/**
 * Weavy component to render a single contextual personal copilot.
 *
 * The copilot component renders a complete and functional user interface for a contextual AI agent chat. It needs to be configured with an AI agent and can have instructions and use any contextual data you provide (as long as it's a string).
 *
 * The copilot chat is agent-to-user which means each user has their own chat with the agent. Each time the chat is loaded a fresh chat is started. It can optionally be configured with a `uid` to persist the conversation. The `uid` needs to be unique to each _user_ and each _agent_ (if you intend to use several agents). You can make a _uid_ with automatically appended _user_ and _agent_ by using the `autoUid` property instead, which generates a value for the `uid` property.
 *
 * @element wy-copilot
 * @class WyCopilot
 * @extends {WeavyComponent}
 * @fires {WyAppEventType} wy-app - Fired whenever the app property changes.
 * @fires {WyMessageEventType} wy-message - Fired when a message has been appended to the conversation.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 *
 * @slot actions - Floating buttons placed in the top right.
 * @slot empty - All the content for the empty state.
 * @slot empty/header - Header for the empty state.
 * @slot empty/header/icon - Display icon in the header.
 * @slot empty/suggestions - Suggestion content.
 * @slot empty/suggestions/suggestion-list - Items for the list in the suggestion content.
 * @slot empty/footer - Footer for the empty state.
 *
 * @example <caption>Generic Copilot</caption>
 * The agent name is required and should correspond to any configured AI agent you have. You may switch between different agents whenever you like, but remember that the conversation also changes.
 *
 * Here we use the built-in *assistant* chat agent.
 *
 * ```html
 * <wy-copilot agent="assistant"></wy-copilot>
 * ```
 *
 * > It's optional to provide a uid and in many cases not needed. When using a uid it's often useful to base the uid on something that identifies the location where the component is rendered. Typically you would use something like a product id, page id, path or URL.
 *
 * @example <caption>Copilot with instructions and contextual data</caption>
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
@customElement(WY_COPILOT_TAGNAME)
@localized()
export class WyCopilot extends WeavyComponent implements WeavyComponentAgentProps {
  static override styles = [hostBlockStyles, hostScrollYStyles, colorModesStyles, hostFontStyles, listStyles];

  override componentType = AppTypeGuid.AgentChat;

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

  protected theme = new ThemeController(this, WyCopilot.styles);
  protected addConversationMutation?: CreateAppMutationType;
  protected conversationRef: Ref<WyConversation> = createRef();
  protected handleRealtimeMessage = handleRealtimeMessage.bind(this);
  protected unsubscribeToRealtime?: () => void;

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
  }

  override render() {
    return this.agent
      ? html`
          <wy-buttons position="floating" reverse>
            ${this.app && this.uid ? html` <wy-notification-button-list></wy-notification-button-list> ` : nothing}
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
                <div class="wy-list">
                  <slot name="suggestion-list">
                    <!--wy-button class="suggestion">Summarize this page</wy-button-->
                  </slot>
                </div>
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
