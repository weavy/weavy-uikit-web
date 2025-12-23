import { html, type PropertyValueMap } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized } from "@lit/localize";
import { type AppType, AppTypeGuid } from "./types/app.types";
import { QueryController } from "./controllers/query-controller";
import { ComponentFeatures } from "./contexts/features-context";
import { createRef, ref } from "lit/directives/ref.js";
import {
  type ConversationFilterProps,
  UnreadConversationsController,
  type UnreadConversationsProps,
} from "./controllers/unread-conversations-controller";
import { DefaultMessengerAgentFeatures, DefaultMessengerFeatures } from "./types/conversation.types";
import { CreateConversationController } from "./controllers/create-conversation-controller";
import { MemberIdType } from "./types/members.types";
import { WyActionEventType } from "./types/action.events";
import { ActionType } from "./types/action.types";
import { NamedEvent } from "./types/generic.types";
import { WeavyTypeComponent } from "./classes/weavy-type-component";

import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostFontCss from "./scss/host-font.scss";
import hostPaddedCss from "./scss/host-padded.scss";
import hostScrollYCss from "./scss/host-scroll-y.scss";

import "./components/wy-conversation-list";
import { WyConversationNew } from "./components/wy-conversation-new";

declare global {
  interface HTMLElementTagNameMap {
    "wy-messenger-conversations": WyMessengerConversations;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyUnreadEventType } from "./types/ui.events"
 */

/**
 * Weavy messenger component to render multiple one-to-one conversations, group chats or agent conversations.
 *
 * **Used sub components:**
 *
 * - [`<wy-conversation-list>`](./components/wy-conversation-list.ts)
 * - [`<wy-conversation-new>`](./components/wy-conversation-new.ts)
 *
 * @tagname wy-messenger-conversations
 * @fires {WyActionEventType} wy-action - Emitted when a conversation is created or an action is performed on a conversation.
 * @fires {WyUnreadEventType} wy-unread - Fired when the number of unread notifications change.
 *
 * @slot actions - Buttons placed in the top right of the conversation list.
 * @slot conversation-new - The button for creating a new conversation. Replaces the button.
 */
@customElement("wy-messenger-conversations")
@localized()
export class WyMessengerConversations
  extends WeavyTypeComponent
  implements UnreadConversationsProps, ConversationFilterProps
{
  static override styles = [colorModesCss, hostBlockCss, hostFontCss, hostPaddedCss, hostScrollYCss];

  /** @internal */
  override componentFeatures = new ComponentFeatures(DefaultMessengerFeatures);

  /** @internal */
  protected theme = new ThemeController(this, WyMessengerConversations.styles);

  /** @internal */
  protected unreadConversations: UnreadConversationsController = new UnreadConversationsController(this);

  /** @internal */
  protected createConversationController: CreateConversationController = new CreateConversationController(this);

  /** Conversation types included in the messenger list. */
  @property({ attribute: false })
  override componentTypes: AppTypeGuid[] = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];

  /**
   * Agent uid filter. When set, conversations are limited to the agent chat.
   */
  @property({ type: String })
  override set agent(agent: string | undefined) {
    super.agent = agent;
    if (this._agentUid) {
      this.componentTypes = [AppTypeGuid.AgentChat];
      this.componentFeatures = new ComponentFeatures(
        DefaultMessengerAgentFeatures,
        this.componentFeatures.allowedFeatures()
      );
    } else {
      this.componentTypes = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];
      this.componentFeatures = new ComponentFeatures(
        DefaultMessengerFeatures,
        this.componentFeatures.allowedFeatures()
      );
    }
    this.conversationId = null;
  }

  override get agent() {
    return super.agent;
  }

  /** Current unread conversation count. */
  get unread(): number {
    return this.unreadConversations.unread;
  }

  /** Active conversation id. */
  @property({ type: Number })
  conversationId?: number | null = null;

  /** @internal */
  protected conversationQuery = new QueryController<AppType>(this);

  /** @internal */
  protected persistState = new PersistStateController(this);

  /** @internal */
  private conversationNewRef = createRef<WyConversationNew>();

  /**
   * Creates a new conversation.
   *
   * When in agent mode, a conversation is created instantly.
   *
   * @param members - Optional array of member id or member uid.
   */
  async createConversation(members?: MemberIdType[]) {
    return await this.createConversationController.create(members);
  }

  /**
   * Opens the select member dialog to let the user choose members.
   *
   * @returns Promise resolving to any selected member ids or uids.
   */
  async selectMembers() {
    return await this.conversationNewRef.value?.selectMembers();
  }

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    await super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("agent") || changedProperties.has("user")) &&
      this.weavy &&
      this.user
    ) {
      this.persistState.observe(
        [{ name: "conversationId", override: false }],
        this.agent || "messenger",
        `u${this.user?.id}`,
        (changedPersistProperties) => {
          if (changedPersistProperties.has("conversationId") && this.conversationId) {
            // Dispatch wy-action event when conversationId is initially restored
            const event: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", {
              detail: {
                action: ActionType.Select,
                app: { id: this.conversationId },
              },
              bubbles: true,
              composed: true,
            });
            this.dispatchEvent(event);
          }
        }
      );
    }

    if (changedProperties.has("agent")) {
      this.createConversationController.agent = this.agent;
    }

    if (changedProperties.has("link") && this.link?.app) {
      this.conversationId = this.link.app.id;
    }

    if (changedProperties.has("componentTypes") || changedProperties.has("agent")) {
      await this.unreadConversations.track(this.componentTypes, this.agent);
    }
  }

  override render() {
    return html`
      <wy-conversation-list
        .conversationTypes=${this.componentTypes}
        .agent=${this.agent}
        conversationId=${ifDefined(this.conversationId !== null ? this.conversationId : undefined)}
        @wy-action=${(e: WyActionEventType) => {
          if (!e.defaultPrevented && e.detail.action === ActionType.Select && e.detail.app !== undefined) {
            this.conversationId = e.detail.app?.id;
          }
        }}
      >
        <wy-conversation-new
          slot="actions"
          .agent=${this.agent}
          @wy-action=${(e: WyActionEventType) => {
            if (!e.defaultPrevented && e.detail.action === ActionType.Select && e.detail.app !== undefined) {
              this.conversationId = e.detail.app?.id;
            }
          }}
          ${ref(this.conversationNewRef)}
        >
          <slot name="conversation-new"></slot>
        </wy-conversation-new>
        <slot name="actions" slot="actions"></slot>
      </wy-conversation-list>
    `;
  }
}
