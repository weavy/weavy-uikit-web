import { html, nothing, type PropertyValues } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized, msg } from "@lit/localize";
import { type AppType, AppTypeGuid } from "./types/app.types";
import { QueryController } from "./controllers/query-controller";
import { getConversationOptions } from "./data/conversation";
import { ComponentFeatures } from "./contexts/features-context";
import { createRef, ref } from "lit/directives/ref.js";
import {
  type ConversationFilterProps,
  UnreadConversationsController,
  type UnreadConversationsProps,
} from "./controllers/unread-conversations-controller";
import { DefaultMessengerFeatures, DefaultMessengerAgentFeatures } from "./types/conversation.types";
import { CreateConversationController } from "./controllers/create-conversation-controller";
import { CreateConversationEventType } from "./types/conversation.events";
import { MemberIdType } from "./types/members.types";
import { WyActionEventType } from "./types/action.events";
import { NamedEvent } from "./types/generic.types";
import { ActionType } from "./types/action.types";

import messengerCss from "./scss/components/messenger.scss";
import scrollCss from "./scss/scroll.scss";
import colorModesCss from "./scss/color-modes.scss";
import hostBlockCss from "./scss/host-block.scss";
import hostFontCss from "./scss/host-font.scss";

import "./components/ui/wy-button";
import "./components/ui/wy-icon";
import "./components/ui/wy-progress-circular";
import "./components/ui/wy-badge";
import "./components/wy-conversation-header";
import "./components/wy-conversation";
import { WyConversationList } from "./components/wy-conversation-list";
import { WyConversationNew } from "./components/wy-conversation-new";
import "./components/wy-context-data";
import "./components/wy-empty";
import { WeavyTypeComponent } from "./classes/weavy-type-component";

declare global {
  interface HTMLElementTagNameMap {
    "wy-messenger": WyMessenger;
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
 * - [`<wy-badge>`](./components/ui/wy-badge.ts)
 * - [`<wy-button>`](./components/ui/wy-button.ts)
 * - [`<wy-container>`](./components/ui/wy-container.ts)
 * - [`<wy-conversation>`](./components/wy-conversation.ts)
 * - [`<wy-conversation-header>`](./components/wy-conversation-header.ts)
 * - [`<wy-conversation-list>`](./components/wy-conversation-list.ts)
 * - [`<wy-conversation-new>`](./components/wy-conversation-new.ts)
 * - [`<wy-context-data-progress>`](./components/wy-context-data.ts)
 * - [`<wy-empty>`](./components/wy-empty.ts)
 * - [`<wy-icon>`](./components/ui/wy-icon.ts) *
 *
 * @tagname wy-messenger
 * @fires {WyActionEventType} wy-action - Emitted when a conversation is created or an action is performed on a conversation.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread notifications change.
 *
 * @slot header - Header content rendered above the conversation list.
 * @slot actions - Action buttons for the conversation list toolbar.
 * @slot conversation-new - Custom content for the new-conversation action.
 * @csspart wy-messenger-layout - Main messenger layout.
 * @csspart wy-scroll-y - Scrollable surface used by list and conversation sections.
 * @csspart wy-messenger-conversation-list - Container for the conversation list.
 * @csspart wy-messenger-conversation - Container for the active conversation.
 * @csspart wy-close-conversation - Wrapper around the close button and unread badge.
 */
@customElement("wy-messenger")
@localized()
export class WyMessenger extends WeavyTypeComponent implements UnreadConversationsProps, ConversationFilterProps {
  static override styles = [colorModesCss, scrollCss, messengerCss, hostBlockCss, hostFontCss];

  /** @internal */
  override componentFeatures = new ComponentFeatures(DefaultMessengerFeatures);

  /** @internal */
  protected theme = new ThemeController(this, WyMessenger.styles);

  /** @internal */
  protected unreadConversationsController: UnreadConversationsController = new UnreadConversationsController(this);

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
    return this.unreadConversationsController.unread;
  }

  /**
   * Placeholder text for the message editor.
   */
  @property()
  placeholder?: string;

  /** Active conversation id. */
  @property({ type: Number })
  conversationId?: number | null = null;

  /** @internal */
  protected conversationQuery = new QueryController<AppType>(this);

  /** @internal */
  protected persistState = new PersistStateController(this);

  /** @internal */
  private conversationListRef = createRef<WyConversationList>();

  /** @internal */
  private conversationNewRef = createRef<WyConversationNew>();

  /**
   * Creates a new conversation.
   *
   * When in agent mode, a conversation is created instantly.
   *
   * @param members - Optional array of member ids or member uids.
   */
  async createConversation(members?: MemberIdType[]) {
    return await this.createConversationController.create(members);
  }

  /**
   * Opens the select member dialog to let the user select members for creating a conversation.
   *
   * @returns Promise resolving to any selected member ids or uids.
   */
  async selectMembers() {
    return await this.conversationNewRef.value?.selectMembers();
  }

  protected override async willUpdate(changedProperties: PropertyValues<this>): Promise<void> {
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

    if (changedProperties.has("link") && this.link?.app) {
      this.conversationId = this.link.app.id;
    }

    if ((changedProperties.has("conversationId") || changedProperties.has("weavy")) && this.weavy) {
      if (this.conversationId) {
        void this.conversationQuery.trackQuery(
          getConversationOptions(this.weavy, this.conversationId, this.componentTypes)
        );
      } else {
        this.conversationQuery.untrackQuery();
      }
    }

    if (changedProperties.has("agent")) {
      this.createConversationController.agent = this.agent;
    }

    if (changedProperties.has("componentTypes") || changedProperties.has("agent")) {
      await this.unreadConversationsController.track(this.componentTypes, this.agent);
    }
  }

  override render() {
    const { isPending: networkIsPending } = this.weavy?.network ?? { isPending: true };
    const { data: conversation } = this.conversationQuery.result ?? { isPending: networkIsPending };

    const conversationListLength = this.conversationListRef.value?.conversationsQuery.result.data?.pages[0].count || 0;

    return html`
      <div part="wy-messenger-layout">
        <div
          part="wy-messenger-conversation-list"
          data-conversation-id=${this.conversationId !== null && this.conversationId !== undefined
            ? this.conversationId
            : ""}
        >
          <wy-container padded outer scrollY>
            <slot name="header"></slot>
            <wy-conversation-list
              ${ref(this.conversationListRef)}
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
                @create=${async (e: CreateConversationEventType) => {
                  const newApp = await this.createConversationController.create(e.detail.members);
                  if (newApp) {
                    this.conversationId = newApp.id;
                  }
                }}
                ${ref(this.conversationNewRef)}
              >
                <slot name="conversation-new"></slot>
              </wy-conversation-new>
              <slot name="actions" slot="actions"></slot>
            </wy-conversation-list>
          </wy-container>
        </div>

        <div
          part="wy-messenger-conversation wy-scroll-y"
          data-conversation-id=${this.conversationId !== null && this.conversationId !== undefined
            ? this.conversationId
            : ""}
        >
          <wy-conversation-header
            .conversationId=${this.conversationId || undefined}
            .conversation=${conversation}
            @wy-action=${(e: WyActionEventType) => {
              if (!e.defaultPrevented && e.detail.action === ActionType.Select && e.detail.app !== undefined) {
                this.conversationId = e.detail.app?.id;
              }
            }}
            ?hidden=${Boolean(!this.conversationId)}
          >
            <span slot="icon" part="wy-close-conversation">
              <wy-button kind="icon" @click=${() => (this.conversationId = null)}>
                <wy-icon name="back"></wy-icon>
              </wy-button>
              <wy-badge
                reveal
                .count=${this.unreadConversationsController.isUnreadPending
                  ? NaN
                  : this.unreadConversationsController.unread}
              ></wy-badge>
            </span>
          </wy-conversation-header>

          ${this.conversationId
            ? html`<wy-conversation
                .conversationId=${this.conversationId}
                .conversation=${conversation}
                .placeholder=${this.placeholder ?? (this.agent ? msg("Ask anything...") : undefined)}
                .header=${!this.agent}
              ></wy-conversation>`
            : conversationListLength
            ? html`<wy-empty noNetwork>${msg("Select a conversation")}</wy-empty>`
            : nothing}
        </div>

        <wy-context-data-progress></wy-context-data-progress>
      </div>
    `;
  }
}
