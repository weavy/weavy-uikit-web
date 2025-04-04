import { customElement } from "./utils/decorators/custom-element";
import { ThemeController } from "./controllers/theme-controller";
import { html, nothing, PropertyValues } from "lit";
import { AppTypeGuid, AppTypeString } from "./types/app.types";
import { WeavyComponent } from "./classes/weavy-component";
import { localized } from "@lit/localize";
import { ComponentFeatures, Feature } from "./contexts/features-context";
import { property } from "lit/decorators.js";
import { CreateAppMutationType, getCreateAppMutation } from "./data/app";
import { createRef, ref, Ref } from "lit/directives/ref.js";
import { v4 as uuid_v4 } from "uuid";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "./utils/keyboard";
import { ContextDataType } from "./types/refs.types";
import { asArray } from "./utils/objects";
import { getTitleFromText, truncateText } from "./utils/strings";

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
import { handleRealtimeMessage } from "./realtime/messages.realtime";

export const WY_COPILOT_TAGNAME = "wy-copilot";

declare global {
  interface HTMLElementTagNameMap {
    [WY_COPILOT_TAGNAME]: WyCopilot;
  }
}

/**
 * Weavy component to render a single contextual personal copilot.
 * 
 * The copilot component renders a complete and functional user interface for a contextual AI bot chat. It needs to be configured with a chat bot and can have instructions and use any contextual data you provide (as long as it's a string).
 * 
 * The copilot chat is bot-to-user which means each user has their own chat with the bot. Each time the chat is loaded a fresh chat is started. It can optionally be configured with a `uid` to persist the conversation. The `uid` needs to be unique to each _user_ and each _bot_ (if you intend to use several bots). You can make a _uid_ with automatically appended _user_ and _bot_ by using the `autoUid` property instead, which generates a value for the `uid` property.
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
 * The bot name is required and should correspond to any configured bot you have. You may switch between different bots whenever you like, but remember that the conversation also changes.
 * 
 * Here we use the built-in *assistant* chat bot.
 * 
 * ```html
 * <wy-copilot bot="assistant"></wy-copilot>
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
 * <wy-copilot id="my-copilot" bot="assistant"></wy-copilot>
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
 * <wy-copilot id="my-copilot" bot="assistant">
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
export class WyCopilot extends WeavyComponent {
  static override styles = [hostBlockStyles, hostScrollYStyles, colorModesStyles, hostFontStyles, listStyles];

  override componentType = AppTypeGuid.BotChat;

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

  /**
   * Any specific instructions for the bot. Overrides any pre configured bot instructions.
   */
  @property({ attribute: true })
  instructions?: string;

  /**
   * Array with any contextual data. The data is uploaded upon change.
   *
   * *Note: Only the first item in the array is currently used.*
   */
  @property({
    attribute: true,
    type: String,
    converter: {
      fromAttribute(value) {
        return asArray(value);
      },
    },
  })
  data?: ContextDataType[];

  /**
   * Sets the editor input to a suggested text. This replaces the text content of the editor. This can be used to create any custom suggestions.
   *
   * @param {string} text - The text suggestion to place in the editor.
   */
  setSuggestion(text: string) {
    this.conversationRef.value?.setEditorText(text);
  }

  protected override willUpdate(changedProperties: PropertyValues): void {
    super.willUpdate(changedProperties);

    if (changedProperties.has("weavy") && this.weavy) {
      this.addConversationMutation = getCreateAppMutation(this.weavy);
    }

    if ((changedProperties.has("app") || changedProperties.has("weavy")) && this.weavy) {
      this.unsubscribeToRealtime?.();

      if (this.app) {
        const subscribeGroup = `a${this.app.id}`;

        this.weavy.subscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);

        this.unsubscribeToRealtime = () => {
          this.weavy?.unsubscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
          this.unsubscribeToRealtime = undefined;
        };
      }
    }
  }

  override render() {
    return this.bot
      ? html`
          <wy-buttons floating reverse>
            ${this.app && this.uid ? html` <wy-notification-button-list></wy-notification-button-list> ` : nothing}
            <slot name="actions"></slot>
          </wy-buttons>
          <wy-conversation
            ${ref(this.conversationRef)}
            .conversation=${this.app}
            .conversationId=${this.app?.id}
            .contextInstructions=${this.instructions}
            .contextData=${this.data}
            .createConversation=${this.bot && this.addConversationMutation
              ? async (payload: Parameters<NonNullable<WyConversation["createConversation"]>>[0]) => {
                  if (!this.bot || !this.addConversationMutation) {
                    throw new Error("Bot or addConversationMutation not defined");
                  }
                  const conversationOptions = {
                    uid: `wy-copilot-${uuid_v4()}`,
                    name: truncateText(getTitleFromText(this.name ?? payload.text)),
                    members: [this.bot],
                    type: AppTypeString.BotChat,
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
                  this.setSuggestion((e.target as HTMLElement).innerText);
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
