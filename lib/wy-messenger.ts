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
 * The Weavy Messenger component renders a full featured chat interface for private messaging, chat rooms, or AI agent conversations.
 *
 * It displays a list of all conversations with possibility to pin, star and mark conversations as read.
 * Each conversation item displays an avatar, the participants or the room name as title, a line with the latest message.
 * It also indicates if the conversation is read/unread and if anyone in the conversation is typing.
 *
 * The list has a search in the top and can open a modal for creating new conversations where the user can search for other people or agents to create private chats or chat rooms.
 *
 * When a user clicks a conversation item, the conversation is loaded.
 * The conversation can show rich messages with markdown formatting including code syntax highlight.
 * Messages can have uploaded images, attached files and cloud files with full browser preview of 100+ formats.
 * Polls, video meetings, rich link embeds, tags and mentions can be used in messages.
 * Users can react with predefined emojis to each message.
 *
 * Read receipts indicate which messages that has been sent and read.
 * The online presence for users is indicated both in the conversation list as well as in the conversation.
 *
 * Typing indicators are shown when other users are typing in a conversation.
 *
 * New messages are indicated as new when received.
 *
 * For chat rooms, the name and avatar for the chat room can be edited. Members can be added or removed from the chat room.
 *
 * The editor features markdown preview, including code syntax highlighting.
 * It has buttons for adding polls, video meetings, images, files and cloud files.
 * Mentions brings up a user selector.
 * Drafts are automatically saved for each conversation.
 *
 * The Messenger can optionally be configured in _agent mode_, by defining the `agent` property, to only show conversations with a given [AI agent](https://www.weavy.com/docs/learn/integrations/agents).
 * In agent mode, the create conversation button instantly creates a new conversation with the agent when clicked, instead of opening a create conversation modal.
 *
 * > Complement this with the [`<wy-notification-toasts>`](./wy-notification-toasts.ts) component to also get realtime _in-app notifications_ or _browser notifications_ when new messages arrive.
 *
 * ** Component layout **
 *
 * The layout depends on the width of its container, which has a breakpoint at `768px`.
 *
 * - In narrow layouts, the conversation list and chat will be stacked and clicking on a conversation in the list will navigate to the chat.
 * - In wider layouts, the component has a side-by-side layout with the conversation list on the left hand side and the chat window on the right hand side.
 *
 * The component is [block-level](https://developer.mozilla.org/en-US/docs/Glossary/Block-level_content) with pre-defined CSS styling to adapt to flex- and grid-layouts as well as traditional flow-layouts.
 * It's usually recommended to use a proper flex-layout for the container you are placing the component in for a smooth layout integration.
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
 * - [`<wy-badge>`](./components/ui/wy-badge.ts)
 * - [`<wy-button>`](./components/ui/wy-button.ts)
 * - [`<wy-container>`](./components/ui/wy-container.ts)
 * - [`<wy-conversation>`](./components/wy-conversation.ts)
 * - [`<wy-conversation-header>`](./components/wy-conversation-header.ts)
 * - [`<wy-conversation-list>`](./components/wy-conversation-list.ts)
 * - [`<wy-conversation-new>`](./components/wy-conversation-new.ts)
 * - [`<wy-context-data-progress>`](./components/wy-context-data.ts)
 * - [`<wy-empty>`](./components/wy-empty.ts)
 * - [`<wy-icon>`](./components/ui/wy-icon.ts)
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
 *
 * @example <caption>Standard Messenger</caption>
 *
 * A messenger placed in a container using a flex layout.
 *
 * ```html
 * <div style="display: flex; height: 100%;">
 *  <wy-messenger></wy-messenger>
 * </div>
 * ```
 *
 * @example <caption>Agent Messenger</caption>
 *
 * Messenger in _agent mode_ only using the built-in "assistant" agent. Using optional `contextualData` to connect content from the page with the agent.
 *
 * ```html
 * <div id="my-content">Lorem ipsum</div>
 * <wy-messenger agent="assistant"></wy-messenger>
 * <script>
 * const myContent = document.querySelector("#my-content");
 * const messenger = document.querySelector("wy-messenger");
 * messenger.contextualData = myContent.innerHTML;
 * </script>
 * ```
 *
 * @example <caption>Messenger adapting to edges</caption>
 *
 * Messenger that adapts to fit nicely with the edges of a panel.
 *
 * ```html
 * <style>
 *   .messenger-panel {
 *     display: flex;
 *     height: 100%;
 *     width: 32rem;
 *     border: 1px solid gray;
 *     --wy-padding-outer: 0;
 *     --wy-border-radius-outer: 0;
 *   }
 * </style>
 * <div class="messenger-panel">
 *  <wy-messenger></wy-messenger>
 * </div>
 * ```
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
        this.componentFeatures.allowedFeatures(),
      );
    } else {
      this.componentTypes = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];
      this.componentFeatures = new ComponentFeatures(
        DefaultMessengerFeatures,
        this.componentFeatures.allowedFeatures(),
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
   * Optional agent instructions appended to submitted messages.
   */
  @property()
  instructions?: string;

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
    this.conversationId = null;
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
        },
      );
    }

    if (changedProperties.has("link") && this.link?.app) {
      this.conversationId = this.link.app.id;
    }

    if ((changedProperties.has("conversationId") || changedProperties.has("weavy")) && this.weavy) {
      if (this.conversationId) {
        void this.conversationQuery.trackQuery(
          getConversationOptions(this.weavy, this.conversationId, this.componentTypes),
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
          part="wy-messenger-conversation-list wy-scroll-y"
          data-conversation-id=${this.conversationId !== null && this.conversationId !== undefined
            ? this.conversationId
            : ""}
        >
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
              <wy-button kind="inline" @click=${() => (this.conversationId = null)}>
                <wy-icon name="back">
                  <wy-badge
                    reveal
                    .count=${this.unreadConversationsController.isUnreadPending
                      ? NaN
                      : this.unreadConversationsController.unread}
                  ></wy-badge>
                </wy-icon>
              </wy-button>
            </span>
          </wy-conversation-header>

          ${this.conversationId
            ? html`<wy-conversation
                .conversationId=${this.conversationId}
                .conversation=${conversation}
                .agentInstructions=${this.instructions}
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
