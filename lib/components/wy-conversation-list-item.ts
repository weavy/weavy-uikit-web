import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../contexts/weavy-context";
import chatCss from "../scss/all";
import type { MessageType } from "../types/messages.types";
import type { UserType } from "../types/users.types";
import { type MembersResultType } from "../types/members.types";
import { localized, msg } from "@lit/localize";
import { DeliveredConversationMutationType, getDeliveredConversationMutation } from "../data/conversation";
import { relativeTime } from "../utils/datetime";
import { ifDefined } from "lit/directives/if-defined.js";
import { RealtimeConversationMarkedEventType, RealtimeMessageEventType } from "../types/realtime.types";
import { WeavyContextProps } from "../types/weavy.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { ConversationTypeGuid } from "../types/conversations.types";
import { userContext } from "../contexts/user-context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import "./wy-avatar";
import "./wy-typing";
import "./wy-icon";
import "./wy-button";
import "./wy-dropdown";

@customElement("wy-conversation-list-item")
@localized()
export default class WyConversationListItem extends LitElement {
  static override styles = chatCss;
  protected exportParts = new ShadowPartsController(this);

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContextType;

  @property({ attribute: true, type: Number })
  conversationId!: number;

  @property({ attribute: true, type: Boolean })
  unread: boolean = false;

  @property({ attribute: true })
  avatarUrl?: string = "";

  @property({ attribute: true, type: Boolean })
  hideAvatar: boolean = false;

  @property({ attribute: true })
  displayName: string = "";

  @property({ attribute: true, type: String, reflect: true })
  type: ConversationTypeGuid = ConversationTypeGuid.PrivateChat;

  @property({ attribute: true, type: Boolean, reflect: true })
  selected: boolean = false;

  @property({ attribute: true, type: Boolean, reflect: true })
  starred: boolean = false;

  @property({ attribute: true, type: Boolean, reflect: true })
  pinned: boolean = false;

  @property({ attribute: false })
  members!: MembersResultType;

  @property({ attribute: false })
  lastMessage?: MessageType;

  @consume({ context: userContext, subscribe: true })
  @state()
  user: UserType | undefined;

  private deliveredConversationMutation?: DeliveredConversationMutationType;

  private handleMessageCreated = (realtimeEvent: RealtimeMessageEventType) => {
    if (!this.user) {
      return;
    }

    if (realtimeEvent.message.app.id === this.conversationId && realtimeEvent.actor.id !== this.user.id) {
      this.deliveredConversationMutation?.mutate({
        id: this.conversationId,
      });
    }

    this.dispatchRefetch();
  };

  private handleConversationUpdated = () => {
    this.dispatchRefetch();
  };

  private handleConversationMarked = (realtimeEvent: RealtimeConversationMarkedEventType) => {
    if (!this.user) {
      return;
    }

    if (realtimeEvent.actor.id === this.user.id) {
      this.dispatchRefetch();
    }
  };

  private dispatchRefetch() {
    const event = new CustomEvent("refetch", {});
    return this.dispatchEvent(event);
  }

  private dispatchSelected(e: Event, id: number) {
    e.preventDefault();
    const event = new CustomEvent("selected", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  private handleStar(e: Event, star: boolean) {
    e.preventDefault();
    e.stopPropagation();

    const event = new CustomEvent("star", {
      detail: { id: this.conversationId, star: star },
    });
    return this.dispatchEvent(event);
  }

  private handlePin(e: Event, pin: boolean) {
    e.preventDefault();
    e.stopPropagation();

    const event = new CustomEvent("pin", {
      detail: { id: this.conversationId, pin: pin },
    });
    return this.dispatchEvent(event);
  }

  private dispatchMarked(markAsRead: boolean) {
    const event = new CustomEvent("mark", {
      detail: { id: this.conversationId, markAsRead: markAsRead, messageId: this.lastMessage?.id },
    });
    return this.dispatchEvent(event);
  }

  private handleLeaveConversation() {
    const event = new CustomEvent("leave", {
      detail: { id: this.conversationId },
    });
    return this.dispatchEvent(event);
  }

  private handleTrashConversation() {
    const event = new CustomEvent("trash", {
      detail: { id: this.conversationId },
    });
    return this.dispatchEvent(event);
  }

  override willUpdate(changedProperties: PropertyValueMap<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.deliveredConversationMutation = getDeliveredConversationMutation(this.weavyContext);

      // realtime
      this.weavyContext.subscribe(`a${this.conversationId}`, "app_updated", this.handleConversationUpdated);
      this.weavyContext.subscribe(`a${this.conversationId}`, "member_added", this.handleConversationUpdated);
      this.weavyContext.subscribe(`a${this.conversationId}`, "message_created", this.handleMessageCreated);
      this.weavyContext.subscribe(`a${this.conversationId}`, "conversation_marked", this.handleConversationMarked);

      // set as delivered ?
      if (this.unread) {
        this.deliveredConversationMutation?.mutate({
          id: this.conversationId,
        });
      }
    }
  }

  override render() {
    const dateFull = this.lastMessage?.created_at
      ? new Intl.DateTimeFormat(this.weavyContext?.locale, { dateStyle: "full", timeStyle: "short" }).format(
          new Date(this.lastMessage.created_at)
        )
      : "";
    const dateFromNow = this.lastMessage?.created_at
      ? relativeTime(this.weavyContext?.locale, new Date(this.lastMessage.created_at))
      : "";

    const otherMember =
      this.type === ConversationTypeGuid.PrivateChat && this.user
        ? (this.members?.data || []).filter((member) => member.id !== this.user?.id)?.[0] ?? this.user
        : null;

    return html`
      <div
        class=${classMap({
          "wy-item wy-item-lg wy-item-hover wy-conversation": true,
          "wy-unread": this.unread,
          "wy-active": this.selected,
        })}
        tabindex="0"
        @click=${(e: Event) => this.dispatchSelected(e, this.conversationId)}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >

        ${this.type !== ConversationTypeGuid.BotChat
          ? this.avatarUrl
            ? html`<wy-avatar .size=${48} src=${this.avatarUrl}></wy-avatar>`
            : this.type == ConversationTypeGuid.ChatRoom
            ? html` <wy-avatar-group .members=${this.members?.data} title=${this.displayName} .size=${48}></wy-avatar-group>`
            : html`
                <wy-avatar
                  src=${ifDefined(otherMember?.avatar_url)}
                  name=${ifDefined(otherMember?.display_name)}
                  presence=${otherMember?.presence || "away"}
                  ?isBot=${otherMember?.is_bot}
                  id=${ifDefined(otherMember?.id)}
                  size=${48}
                ></wy-avatar>
              `
          : nothing}

        <div class="wy-item-rows">
          <div class="wy-item-row">
            <div class="wy-item-title"
              >${this.displayName || this.lastMessage?.plain || msg("Untitled conversation")}</div
            >
            ${this.lastMessage
              ? html`<time class="wy-meta" datetime=${this.lastMessage.created_at.toString()} title=${dateFull}
                  >${dateFromNow}</time
                >`
              : nothing}
          </div>
          <div class="wy-item-row">
            <div class="wy-item-text">
              ${this.user
                ? html`
                    <wy-typing appId=${this.conversationId} userId=${this.user.id}>
                      ${this.lastMessage
                        ? html`
                            ${this.user.id === this.lastMessage.created_by.id ? html`${msg("You")}: ` : nothing}
                            ${this.members.count > 2 && this.user.id !== this.lastMessage?.created_by.id
                              ? html`${this.lastMessage?.created_by.display_name}: `
                              : nothing}
                          `
                        : nothing}
                      ${this.lastMessage?.text ? html`<span>${this.lastMessage.plain}</span>` : nothing}
                      ${!this.lastMessage?.text && (this.lastMessage?.attachments?.count || 0) > 0
                        ? html`<wy-icon kind="text-icon" name="attachment"></wy-icon>`
                        : nothing}
                      ${!this.lastMessage?.text && this.lastMessage?.meeting?.id
                        ? html`<wy-icon kind="text-icon" name="zoom"></wy-icon>`
                        : nothing}
                      ${!this.lastMessage ? html`&nbsp;` : nothing}
                    </wy-typing>
                  `
                : nothing}
            </div>

            <div class="wy-item-actions wy-item-actions-bottom">
              ${this.starred
                ? html`<wy-button kind="icon" @click=${(e: Event) => this.handleStar(e, false)}>
                    <wy-icon name="star" size=${24} color="yellow"></wy-icon>
                  </wy-button>`
                : nothing}
              ${this.pinned
                ? html`<wy-button kind="icon" @click=${(e: Event) => this.handlePin(e, false)}
                    ><wy-icon name="pin" size=${24} color=""></wy-icon
                  ></wy-button>`
                : nothing}

              <wy-dropdown>
                ${!this.selected
                  ? html`<wy-dropdown-item @click=${() => this.dispatchMarked(this.unread)}>
                      <wy-icon name=${this.unread ? "unread" : "read"}></wy-icon>
                      ${this.unread ? msg("Mark as read") : msg("Mark as unread")}
                    </wy-dropdown-item>`
                  : nothing}
                <wy-dropdown-item @click=${(e: Event) => this.handlePin(e, !this.pinned)}>
                  <wy-icon name=${this.pinned ? "unpin" : "pin"}></wy-icon>
                  ${this.pinned ? msg("Unpin") : msg("Pin")}
                </wy-dropdown-item>
                <wy-dropdown-item @click=${(e: Event) => this.handleStar(e, !this.starred)}>
                  <wy-icon name=${this.starred ? "unstar" : "star"}></wy-icon>
                  ${this.starred ? msg("Unstar") : msg("Star")}
                </wy-dropdown-item>
                ${this.type === ConversationTypeGuid.ChatRoom
                  ? html`<wy-dropdown-item @click=${() => this.handleLeaveConversation()}>
                      <wy-icon name="account-minus"></wy-icon>
                      ${msg("Leave conversation")}
                    </wy-dropdown-item>`
                  : nothing}
                ${this.type === ConversationTypeGuid.BotChat
                  ? html`
                      <wy-dropdown-item @click=${() => this.handleTrashConversation()}>
                        <wy-icon name="trashcan"></wy-icon>
                        ${msg("Trash")}
                      </wy-dropdown-item>
                    `
                  : nothing}
              </wy-dropdown>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  // override disconnectedCallback(): void {
  //   // realtime
  //   if (this.weavyContext) {
  //     this.weavyContext.unsubscribe(`a${this.conversationId}`, "app_updated", this.handleConversationUpdated);
  //     this.weavyContext.unsubscribe(`a${this.conversationId}`, "member_added", this.handleConversationUpdated);
  //     this.weavyContext.unsubscribe(`a${this.conversationId}`, "message_created", this.handleMessageCreated);
  //     this.weavyContext.unsubscribe(`a${this.conversationId}`, "conversation_marked", this.handleConversationMarked);
  //   }
  //   super.disconnectedCallback();
  // }
}
