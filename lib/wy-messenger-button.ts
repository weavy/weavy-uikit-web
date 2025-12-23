import { html, nothing, type PropertyValues } from "lit";
import { customElement } from "./utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { PersistStateController } from "./controllers/persist-state-controller";
import { ifDefined } from "lit/directives/if-defined.js";
import { ThemeController } from "./controllers/theme-controller";
import { localized, msg } from "@lit/localize";
import { type AppType, AppTypeGuid } from "./types/app.types";
import { QueryController } from "./controllers/query-controller";
import { WeavyTypeComponent } from "./classes/weavy-type-component";
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
import type { BadgeAppearanceType, OverlayAppearanceType, PositionType } from "./types/ui.types";

import messengerStyles from "./scss/components/messenger.scss";
import scrollCss from "./scss/scroll.scss";
import colorModesStyles from "./scss/color-modes.scss";
import hostBlockStyles from "./scss/host-block.scss";
import hostFontStyles from "./scss/host-font.scss";

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

declare global {
  interface HTMLElementTagNameMap {
    "wy-messenger-button": WyMessengerButton;
  }
}

/**
 * @import { WyAppEventType } from "./types/app.events"
 * @import { WyPreviewOpenEventType } from "./types/files.events"
 * @import { WyPreviewCloseEventType } from "./types/files.events"
 * @import { WyUnreadEventType } from "./types/ui.events"
 */

/**
 * Weavy messenger component to render a button with badge that opens multiple one-to-one conversations, group chats or agent conversations in an overlay.
 *
 * **Used sub components:**
 *
 * - [`<wy-badge>`](./components/ui/wy-badge.ts)
 * - [`<wy-button>`](./components/ui/wy-button.ts)
 * - [`<wy-conversation>`](./components/wy-conversation.ts)
 * - [`<wy-conversation-header>`](./components/wy-conversation-header.ts)
 * - [`<wy-conversation-list>`](./components/wy-conversation-list.ts)
 * - [`<wy-conversation-new>`](./components/wy-conversation-new.ts)
 * - [`<wy-context-data-progress>`](./components/wy-context-data.ts)
 * - [`<wy-empty>`](./components/wy-empty.ts)
 * - [`<wy-icon>`](./components/ui/wy-icon.ts)
 * - [`<wy-overlay>`](./components/wy-overlay.ts)
 * - [`<wy-titlebar>`](./components/wy-titlebar.ts)
 *
 * @tagname wy-messenger-button
 * @fires {WyActionEventType} wy-action - Emitted when a conversation is created or an action is performed on a conversation.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread notifications change.
 *
 * @slot header - Header content rendered at the top of the conversation list overlay.
 * @slot title - Title content displayed within the overlay header.
 * @slot actions - Buttons placed in the top right of the conversation list.
 * @slot conversation-new - Custom content for the new-conversation button.
 *
 * @csspart wy-messenger-overlay-container - Container for the Messenger within the overlay.
 * @csspart wy-messenger-layout - Outermost messenger layout wrapper inside the overlay.
 * @csspart wy-messenger-overlay-container - Container that positions the messenger content in the overlay.
 * @csspart wy-scroll-y - Scrollable surface used by list and conversation sections.
 * @csspart wy-messenger-conversation-list - Container for conversation list.
 * @csspart wy-messenger-conversation - Container for the active conversation.
 * @csspart wy-close-conversation - Wrapper for the close-conversation icon and badge.
 */
@customElement("wy-messenger-button")
@localized()
export class WyMessengerButton extends WeavyTypeComponent implements UnreadConversationsProps, ConversationFilterProps {
  static override styles = [colorModesStyles, scrollCss, messengerStyles, hostBlockStyles, hostFontStyles];

  /** @internal */
  override componentFeatures = new ComponentFeatures(DefaultMessengerFeatures);

  /** @internal */
  protected theme = new ThemeController(this, WyMessengerButton.styles);

  /** @internal */
  protected unreadConversationsController: UnreadConversationsController = new UnreadConversationsController(this);

  /** @internal */
  protected createConversationController: CreateConversationController = new CreateConversationController(this);

  /**
   * Overlay appearance used for the conversation list.
   *
   * @type {"modal" | "sheet" | "drawer" | "full" | "none"}
   * @default "drawer"
   */
  @property({ type: String })
  list: OverlayAppearanceType = "drawer";

  /**
   * Badge appearance variant.
   *
   * @type {"count" | "compact" | "dot" | "none"}
   * @default "compact"
   */
  @property({ type: String })
  badge: BadgeAppearanceType = "compact";

  /**
   * Badge position relative to the messenger button.
   *
   * @type {"inline" | "top-right" | "bottom-right" | "bottom-left" | "top-left"}
   * @default "top-right"
   */
  @property({ type: String })
  badgePosition: PositionType = "top-right";

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
  @state()
  show = false;

  /** @internal */
  @state()
  maximized = false;

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
   * - When in agent mode, a conversation is created instantly.
   *
   * @param members {(number|string)[] | undefined} - Optional array of member id or member uid.
   */
  async createConversation(members?: MemberIdType[]) {
    return await this.createConversationController.create(members);
  }

  /**
   * Opens the select member dialog to let the user select members for creating a conversation.
   *
   * @returns Any selected member ids or uids.
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
        void this.conversationQuery.trackQuery(getConversationOptions(this.weavy, this.conversationId, this.componentTypes));
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
      <wy-button kind="icon" ?active=${this.show} @click=${() => (this.show = !this.show)}>
        <wy-icon name="message-text">
          ${this.user && this.badge !== "none"
            ? html`
                <wy-badge
                  appearance=${this.badge}
                  position=${this.badgePosition}
                  .count=${this.unreadConversationsController.isUnreadPending
                    ? NaN
                    : this.unreadConversationsController.unread}
                ></wy-badge>
              `
            : nothing}
        </wy-icon>
      </wy-button>

      ${this.list !== "none"
        ? html`<wy-overlay
            type=${this.list}
            .show=${this.show}
            .maximized=${this.maximized}
            @close=${() => (this.show = false)}
            noHeader
          >
            <div part="wy-messenger-layout wy-messenger-overlay-container">
              <div
                part="wy-messenger-conversation-list wy-scroll-y"
                data-conversation-id=${this.conversationId !== null && this.conversationId !== undefined
                  ? this.conversationId
                  : ""}
              >
                <slot name="header">
                  <wy-titlebar floating header outer>
                    <wy-button kind="icon" slot="icon" @click=${() => (this.show = false)}
                      ><wy-icon name="close"></wy-icon
                    ></wy-button>
                    <slot name="title" slot="title">${msg("Conversations")}</slot>
                    <slot name="actions" slot="actions"></slot>
                    <wy-button kind="icon" slot="actions" @click=${() => (this.maximized = !this.maximized)}
                      ><wy-icon name=${this.maximized ? "arrow-collapse" : "arrow-expand"}></wy-icon
                    ></wy-button>
                  </wy-titlebar>
                </slot>

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
          </wy-overlay> `
        : nothing}
    `;
  }
}
