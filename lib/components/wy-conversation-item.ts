import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import type { MessageType } from "../types/messages.types";
import type { UserType } from "../types/users.types";
import { type MembersResultType } from "../types/members.types";
import { localized, msg } from "@lit/localize";
import { relativeTime } from "../utils/datetime";
import { ifDefined } from "lit/directives/if-defined.js";
import { RealtimeAppMarkedEventType, RealtimeMessageEventType } from "../types/realtime.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { UserContext } from "../contexts/user-context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { updateCacheItem, updateCacheItems } from "../utils/query-cache";
import { AppType, AppTypeGuid } from "../types/app.types";
import { MessagesMarkEventType } from "../types/messages.events";
import { NamedEvent } from "../types/generic.types";
import {
  LeaveEventType,
  PinEventType,
  RemoveEventType,
  SelectedEventType,
  StarEventType,
  TrashEventType,
} from "../types/app.events";

import conversationsCss from "../scss/components/conversations.scss";

import "./ui/wy-avatar";
import "./ui/wy-button";
import "./ui/wy-dropdown";
import "./ui/wy-icon";
import "./ui/wy-item";
import "./wy-typing";

declare global {
  interface HTMLElementTagNameMap {
    "wy-conversation-item": WyConversationItem;
  }
}

/**
 * Item display of a conversation for use in lists.
 *
 * **Used sub components**
 *
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-dropdown-item>`](./ui/wy-dropdown.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-avatar-group>`](./ui/wy-avatar.ts)
 * - [`<wy-typing>`](./wy-typing.ts)
 *
 * @csspart wy-conversation-item - The conversation item container (applied on the inner wy-item)
 *
 * @fires {SelectedEventType} selected - Emitted when the conversation item is selected.
 * @fires {StarEventType} star - Emitted when the star/unstar action is requested.
 * @fires {PinEventType} pin - Emitted when the pin/unpin action is requested.
 * @fires {MessagesMarkEventType} mark - Emitted when the conversation should be marked read/unread.
 * @fires {LeaveEventType} leave - Emitted when the current user requests to leave the conversation.
 * @fires {RemoveEventType} remove - Emitted when the conversation should be removed/deleted.
 * @fires {TrashEventType} trash - Emitted when the conversation should be trashed.
 */
@customElement("wy-conversation-item")
@localized()
export class WyConversationItem extends LitElement {
  static override styles = [conversationsCss];
  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Weavy instance context.
   *
   * @internal
   */
  @consume({ context: WeavyContext, subscribe: true })
  @state()
  weavy?: WeavyType;

  /**
   * User context for the current authenticated user.
   *
   * @internal
   */
  @consume({ context: UserContext, subscribe: true })
  @state()
  user: UserType | undefined;

  /**
   * The id of the conversation.
   *
   * Use this to identify which conversation the item represents.
   */
  @property({ attribute: true, type: Number })
  conversationId?: number;

  /**
   * Whether the conversation is unread.
   */
  @property({ attribute: true, type: Boolean, reflect: true })
  unread: boolean = false;

  /**
   * Url to any custom avatar for the conversation. If omitted, member avatars are used.
   */
  @property({ attribute: true })
  avatarUrl?: string = "";

  /**
   * Whether the avatar should be hidden.
   */
  @property({ attribute: true, type: Boolean, reflect: true })
  hideAvatar: boolean = false;

  /**
   * Any custom title for the conversation item.
   */
  @property({ attribute: true })
  name: string = "";

  /**
   * The type guid of the conversation.
   */
  @property({ attribute: true, type: String })
  type: AppTypeGuid = AppTypeGuid.PrivateChat;

  /**
   * Whether the conversation item is selected.
   */
  @property({ attribute: true, type: Boolean, reflect: true })
  selected: boolean = false;

  /**
   * Whether the conversation is starred.
   */
  @property({ attribute: true, type: Boolean, reflect: true })
  starred: boolean = false;

  /**
   * Whether the conversation is pinned.
   */
  @property({ attribute: true, type: Boolean, reflect: true })
  pinned: boolean = false;

  /**
   * A list of members in the conversation.
   *
   * @internal
   */
  @property({ attribute: false })
  members!: MembersResultType;

  /**
   * The last received message in the conversation.
   *
   * @internal
   */
  @property({ attribute: false })
  lastMessage?: MessageType;

  /**
   * Realtime handler for when new messages have been created.
   *
   * Updates last message and unread state in the query cache.
   *
   * @internal
   * @param realtimeEvent - Realtime message event data.
   */
  private handleMessageCreated = (realtimeEvent: RealtimeMessageEventType) => {
    if (!this.user || !this.weavy) {
      return;
    }

    updateCacheItem(this.weavy.queryClient, ["apps", realtimeEvent.message.app.id], undefined, (item: AppType) => {
      item.last_message = realtimeEvent.message;
      item.is_unread = realtimeEvent.message.created_by.id !== this.user?.id;
    });

    updateCacheItems(
      this.weavy.queryClient,
      { queryKey: ["apps", "list"], exact: false },
      realtimeEvent.message.app.id,
      (item: AppType) => {
        item.last_message = realtimeEvent.message;
        item.is_unread = realtimeEvent.message.created_by.id !== this.user?.id;
      }
    );
  };

  /**
   * Realtime handler for when conversations have been updated.
   *
   * @internal
   */
  private handleConversationUpdated = () => {
    void this.weavy?.queryClient.invalidateQueries({ queryKey: ["apps"], exact: false });
  };

  /**
   * Realtime handler for when conversations are marked as read/unread.
   *
   * @internal
   * @param realtimeEvent - Realtime app marked event data.
   */
  private handleConversationMarked = (realtimeEvent: RealtimeAppMarkedEventType) => {
    if (!this.user) {
      return;
    }

    if (realtimeEvent.actor.id === this.user.id) {
      void this.weavy?.queryClient.invalidateQueries({ queryKey: ["apps"], exact: false });
    }
  };

  /**
   * Trigger `selected` event.
   *
   * @returns Whether the event was dispatched successfully.
   */
  dispatchSelected() {
    if (!this.conversationId) {
      return;
    }
    const event: SelectedEventType = new (CustomEvent as NamedEvent)("selected", {
      detail: { id: this.conversationId },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Trigger `star` event.
   *
   * @param star - Whether the conversation should be starred.
   * @returns Whether the event was dispatched successfully.
   */
  dispatchStar(star: boolean) {
    if (!this.conversationId) {
      return;
    }
    const event: StarEventType = new (CustomEvent as NamedEvent)("star", {
      detail: { id: this.conversationId, star: star },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Trigger `pin` event.
   *
   * @param pin - Whether the conversation should be pinned.
   * @returns Whether the event was dispatched successfully.
   *
   * @internal
   */
  private dispatchPin(pin: boolean) {
    if (!this.conversationId) {
      return;
    }

    const event: PinEventType = new (CustomEvent as NamedEvent)("pin", {
      detail: { id: this.conversationId, pin: pin },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Trigger `mark` event for marking the conversation as read/unread.
   *
   * @param mark - Whether the conversation should be marked as read.
   * @returns Whether the event was dispatched successfully.
   *
   * @internal
   */
  private dispatchMarked(mark: boolean) {
    if (!this.conversationId) {
      return;
    }

    const event: MessagesMarkEventType = new (CustomEvent as NamedEvent)("mark", {
      detail: { id: this.conversationId, messageId: mark ? this.lastMessage?.id : null },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Triggers `leave` event when the current user is leaving the conversation.
   *
   * @returns Whether the event was dispatched successfully.
   *
   * @internal
   */
  private dispatchLeaveConversation() {
    if (!this.conversationId) {
      return;
    }

    const event: LeaveEventType = new (CustomEvent as NamedEvent)("leave", {
      detail: { id: this.conversationId },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Triggers `remove` when the conversation should be removed.
   *
   * @returns Whether the event was dispatched successfully.
   *
   * @internal
   */
  private dispatchRemoveConversation() {
    if (!this.conversationId) {
      return;
    }

    const event: RemoveEventType = new (CustomEvent as NamedEvent)("remove", {
      detail: { id: this.conversationId },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Triggers `trash` event when the conversation should be trashed.
   *
   * @returns Whether the event was dispatched successfully.
   *
   * @internal
   */
  private dispatchTrashConversation() {
    if (!this.conversationId) {
      return;
    }

    const event: TrashEventType = new (CustomEvent as NamedEvent)("trash", {
      detail: { id: this.conversationId },
    });
    return this.dispatchEvent(event);
  }

  /**
   * Unsubscribe function for realtime subscriptions.
   *
   * @internal
   */
  #unsubscribeToRealtime?: () => void;

  override willUpdate(changedProperties: PropertyValueMap<this>): void {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("conversationId")) &&
      this.weavy &&
      this.conversationId
    ) {
      this.#unsubscribeToRealtime?.();

      // realtime
      const subscribeGroup = `a${this.conversationId}`;

      void this.weavy.subscribe(subscribeGroup, "app_updated", this.handleConversationUpdated);
      void this.weavy.subscribe(subscribeGroup, "member_added", this.handleConversationUpdated);
      void this.weavy.subscribe(subscribeGroup, "message_created", this.handleMessageCreated);
      void this.weavy.subscribe(subscribeGroup, "app_marked", this.handleConversationMarked);

      this.#unsubscribeToRealtime = () => {
        void this.weavy?.unsubscribe(subscribeGroup, "app_updated", this.handleConversationUpdated);
        void this.weavy?.unsubscribe(subscribeGroup, "member_added", this.handleConversationUpdated);
        void this.weavy?.unsubscribe(subscribeGroup, "message_created", this.handleMessageCreated);
        void this.weavy?.unsubscribe(subscribeGroup, "app_marked", this.handleConversationMarked);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  override render() {
    const dateFull = this.lastMessage?.created_at
      ? new Intl.DateTimeFormat(this.weavy?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.lastMessage.created_at)
        )
      : "";
    const dateFromNow = this.lastMessage?.created_at
      ? relativeTime(this.weavy?.locale, new Date(this.lastMessage.created_at))
      : "";

    const otherMember =
      this.type === AppTypeGuid.PrivateChat && this.user
        ? (this.members?.data || []).filter((member) => member.id !== this.user?.id)?.[0] ?? this.user
        : null;

    return html`
      <wy-item
        part="wy-conversation-item"
        size="lg"
        interactive
        outer
        status=${this.unread ? "unread" : undefined}
        ?selected=${this.selected}
        tabindex="0"
        actionsPosition="bottom"
        @click=${(e: MouseEvent) => {
          e.preventDefault();
          return this.dispatchSelected();
        }}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >
        ${this.type !== AppTypeGuid.AgentChat
          ? this.avatarUrl
            ? html`<wy-avatar slot="image" .size=${48} src=${this.avatarUrl}></wy-avatar>`
            : this.type == AppTypeGuid.ChatRoom
            ? html` <wy-avatar-group
                slot="image"
                .members=${this.members?.data}
                title=${this.name}
                .size=${48}
              ></wy-avatar-group>`
            : html`
                <wy-avatar
                  slot="image"
                  src=${ifDefined(otherMember?.avatar_url)}
                  name=${ifDefined(otherMember?.name)}
                  description=${ifDefined(otherMember?.comment)}
                  presence=${otherMember?.presence || "away"}
                  ?isAgent=${otherMember?.is_agent}
                  id=${ifDefined(otherMember?.id)}
                  size=${48}
                ></wy-avatar>
              `
          : nothing}

        <span slot="title">${this.name || this.lastMessage?.plain || msg("Untitled conversation")}</span>
        ${this.lastMessage
          ? html`
              <time slot="meta" datetime=${this.lastMessage.created_at.toString()} title=${dateFull}
                >${dateFromNow}</time
              >
            `
          : nothing}
        <span slot="text">
          ${this.user
            ? html`
                <wy-typing appId=${this.conversationId} userId=${this.user.id}>
                  ${this.lastMessage
                    ? html`
                        ${this.user.id === this.lastMessage.created_by.id ? html`${msg("You")}: ` : nothing}
                        ${this.members.count > 2 && this.user.id !== this.lastMessage?.created_by.id
                          ? html`${this.lastMessage?.created_by.name}: `
                          : nothing}
                      `
                    : nothing}
                  ${this.lastMessage?.text ? html`<span>${this.lastMessage.plain}</span>` : nothing}
                  ${!this.lastMessage?.text && (this.lastMessage?.attachments?.count || 0) > 0
                    ? html`<wy-icon kind="text-icon" name="attachment"></wy-icon>`
                    : nothing}
                  ${!this.lastMessage?.text && this.lastMessage?.meeting?.id
                    ? html`<wy-icon kind="text-icon" name="video"></wy-icon>`
                    : nothing}
                  ${!this.lastMessage?.text && (this.lastMessage?.options?.count || 0) > 0
                    ? html`<wy-icon kind="text-icon" name="poll"></wy-icon>`
                    : nothing}
                  ${!this.lastMessage ? html`&nbsp;` : nothing}
                </wy-typing>
              `
            : nothing}
        </span>

        ${this.starred
          ? html`<wy-button
              small
              slot="actions"
              kind="icon"
              @click=${(e: Event) => {
                e.stopPropagation();
                this.dispatchStar(false);
              }}
            >
              <wy-icon name="star" size=${24} color="yellow"></wy-icon>
            </wy-button>`
          : nothing}
        ${this.pinned
          ? html`<wy-button
              small
              slot="actions"
              kind="icon"
              @click=${(e: Event) => {
                e.stopPropagation();
                this.dispatchPin(false);
              }}
            >
              <wy-icon name="pin" size=${20} color=""></wy-icon>
            </wy-button>`
          : nothing}
 
        <wy-dropdown small slot="actions" directionX="left">
          <wy-dropdown-item @click=${() => this.dispatchMarked(this.unread)}>
            <wy-icon name=${this.unread ? "read" : "unread"}></wy-icon>
            ${this.unread ? msg("Mark as read") : msg("Mark as unread")}
          </wy-dropdown-item>
          <wy-dropdown-item @click=${() => this.dispatchPin(!this.pinned)}>
            <wy-icon name=${this.pinned ? "unpin" : "pin"}></wy-icon>
            ${this.pinned ? msg("Unpin") : msg("Pin")}
          </wy-dropdown-item>
          <wy-dropdown-item @click=${() => this.dispatchStar(!this.starred)}>
            <wy-icon name=${this.starred ? "unstar" : "star"}></wy-icon>
            ${this.starred ? msg("Unstar") : msg("Star")}
          </wy-dropdown-item>
          ${this.type === AppTypeGuid.PrivateChat
            ? html`<wy-dropdown-item @click=${() => this.dispatchRemoveConversation()}>
                <wy-icon name="trashcan"></wy-icon>
                ${msg("Delete")}
              </wy-dropdown-item>`
            : nothing}
          ${this.type === AppTypeGuid.ChatRoom
            ? html`<wy-dropdown-item @click=${() => this.dispatchLeaveConversation()}>
                <wy-icon name="account-minus"></wy-icon>
                ${msg("Leave")}
              </wy-dropdown-item>`
            : nothing}
          ${this.type === AppTypeGuid.AgentChat
            ? html`
                <wy-dropdown-item @click=${() => this.dispatchTrashConversation()}>
                  <wy-icon name="trashcan"></wy-icon>
                  ${msg("Delete")}
                </wy-dropdown-item>
              `
            : nothing}
        </wy-dropdown>
      </wy-item>
    `;
  }

  override connectedCallback(): void {
    super.connectedCallback();
    if (this.weavy) {
      this.requestUpdate("weavy");
    }
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
