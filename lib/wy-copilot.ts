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
import { NamedEvent } from "./types/generic.types";
import { WyAppEventType, WyMessageEventType } from "./types/events.types";
import { RealtimeMessageEventType } from "./types/realtime.types";
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

export const WY_COPILOT_TAGNAME = "wy-copilot";

declare global {
  interface HTMLElementTagNameMap {
    [WY_COPILOT_TAGNAME]: WyCopilot;
  }
}

/**
 * Weavy component to render a single contextual personal copilot.
 *
 * @element wy-copilot
 * @class WyCopilot
 * @fires wy-preview-open {WyPreviewOpenEventType}
 * @fires wy-preview-close {WyPreviewCloseEventType}
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

  private addConversationMutation?: CreateAppMutationType;

  @property({ attribute: true })
  autoUid?: string;

  reset() {
    this.app = undefined;
  }

  @property({ attribute: true })
  instructions?: string;

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

  protected conversationRef: Ref<WyConversation> = createRef();

  setSuggestion(text: string) {
    this.conversationRef.value?.setEditorText(text);
  }

  private handleRealtimeMessage = async (realtimeEvent: RealtimeMessageEventType) => {
    if (!this.weavy || !this.app) {
      return;
    }

    const messageDetail: WyMessageEventType["detail"] = {
      message: realtimeEvent.message,
      direction: realtimeEvent.message.created_by.id === this.user?.id ? "outbound" : "inbound",
    }

    if (realtimeEvent.message.created_by.is_bot) {
      messageDetail.bot = realtimeEvent.message.created_by.uid
    }

    const messageEvent: WyMessageEventType = new (CustomEvent as NamedEvent)("wy-message", {
      bubbles: false,
      cancelable: false,
      composed: true,
      detail: messageDetail,
    });
    this.dispatchEvent(messageEvent);
  };

  #unsubscribeToRealtime?: () => void;

  protected override willUpdate(changedProperties: PropertyValues): void {
    if (
      (changedProperties.has("autoUid") || changedProperties.has("user") || changedProperties.has("bot")) &&
      this.autoUid &&
      this.user &&
      this.bot
    ) {
      this.uid = `${this.autoUid}-${this.bot}-${this.user.uid || this.user.id}`;
    }

    super.willUpdate(changedProperties);

    if (changedProperties.has("weavy") && this.weavy) {
      this.addConversationMutation = getCreateAppMutation(this.weavy);
    }

    if ((changedProperties.has("app") || changedProperties.has("weavy")) && this.weavy) {
      this.#unsubscribeToRealtime?.();

      if (this.app) {
        const subscribeGroup = `a${this.app.id}`;

        this.weavy.subscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);

        this.#unsubscribeToRealtime = () => {
          this.weavy?.unsubscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
          this.#unsubscribeToRealtime = undefined;
        };
      }
    }

    if (changedProperties.has("app") && this.app) {
      const appEvent: WyAppEventType = new (CustomEvent as NamedEvent)("wy-app", {
        bubbles: false,
        composed: true,
        detail: {
          app: this.app,
        },
      });
      this.dispatchEvent(appEvent);
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
