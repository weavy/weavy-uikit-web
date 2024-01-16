import { LitElement, html, nothing, type PropertyValues } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import chatCss from "../scss/all.scss";
import type { MessageType } from "../types/messages.types";
import type { UserType } from "../types/users.types";
import { type MembersResultType } from "../types/members.types";
import { localized, msg } from "@lit/localize";
import { DeliveredConversationMutationType, getDeliveredConversationMutation } from "../data/conversation";
import { relativeTime } from "../utils/datetime";
import { ifDefined } from "lit/directives/if-defined.js";

import "./wy-avatar";
import "./wy-typing";
import "./wy-icon";
import "./wy-button";
import "./wy-dropdown";
import { RealtimeConversationMarkedEventType, RealtimeMessageEventType } from "../types/realtime.types";
import { WeavyContextProps } from "../types/weavy.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "src/utils/keyboard";

@customElement("wy-conversation-list-item")
@localized()
export default class WyConversationListItem extends LitElement {
  static override styles = chatCss;

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: true, type: Number })
  conversationId!: number;

  @property({ attribute: true, type: Boolean })
  unread: boolean = false;

  @property({ attribute: true })
  avatarUrl: string = "";

  @property({ attribute: true })
  displayName: string = "";

  @property({ attribute: true, type: Boolean, reflect: true })
  room: boolean = false;

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

  @property({ attribute: false })
  user?: UserType;

  private deliveredConversationMutation?: DeliveredConversationMutationType;

  private handleMessageCreated = (realtimeEvent: RealtimeMessageEventType) => {
    if (realtimeEvent.message.app_id === this.conversationId && realtimeEvent.actor.id !== this.user!.id) {
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
    if (realtimeEvent.actor.id === this.user!.id) {
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

  override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
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

    const otherMember = !this.room
      ? (this.members?.data || []).filter((member) => member.id !== this.user!.id)?.[0]
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
        ${this.room && this.user
          ? html`
              <wy-avatar-group
                .members=${this.members}
                .user=${this.user}
                .name=${this.displayName}
                .size=${48}
              ></wy-avatar-group>
            `
          : html`
              <wy-avatar
                src=${ifDefined(otherMember?.avatar_url)}
                name=${this.displayName}
                size=${48}
                presence=${otherMember?.presence || "away"}
                id=${ifDefined(otherMember?.id)}
              ></wy-avatar>
            `}

        <div class="wy-item-body">
          <div class="wy-item-row">
            <div class="wy-item-title">${this.displayName}</div>
            ${this.lastMessage
              ? html`<time class="wy-meta" datetime=${this.lastMessage.created_at.toString()} title=${dateFull}
                  >${dateFromNow}</time
                >`
              : nothing}
          </div>
          <div class="wy-item-row">
            <div class="wy-item-text">
              <wy-typing appId=${this.conversationId} userId=${this.user!.id}>
                ${this.lastMessage
                  ? html`
                      ${this.user!.id === this.lastMessage.created_by.id ? html`${msg("You")}: ` : nothing}
                      ${this.members.count > 2 && this.user!.id !== this.lastMessage?.created_by.id
                        ? html`${this.lastMessage?.created_by.display_name}: `
                        : nothing}
                    `
                  : nothing}
                ${this.lastMessage?.text ? html`<span>${this.lastMessage.plain}</span>` : nothing}
                ${!this.lastMessage?.text && (this.lastMessage?.attachment_count || 0) > 0
                  ? html`<wy-icon kind="text-icon" name="attachment"></wy-icon>`
                  : nothing}
                ${!this.lastMessage?.text && this.lastMessage?.meeting_id
                  ? html`<wy-icon kind="text-icon" name="zoom"></wy-icon>`
                  : nothing}
                ${!this.lastMessage ? html`&nbsp;` : nothing}
              </wy-typing>
            </div>
          </div>
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
            <wy-dropdown-item @click=${() => this.dispatchMarked(this.unread)}>
              <wy-icon name=${this.unread ? "unread" : "read"}></wy-icon>
              ${this.unread ? msg("Mark as read") : msg("Mark as unread")}
            </wy-dropdown-item>
            <wy-dropdown-item @click=${(e: Event) => this.handlePin(e, !this.pinned)}>
              <wy-icon name=${this.pinned ? "unpin" : "pin"}></wy-icon>
              ${this.pinned ? msg("Unpin") : msg("Pin")}
            </wy-dropdown-item>
            <wy-dropdown-item @click=${(e: Event) => this.handleStar(e, !this.starred)}>
              <wy-icon name=${this.starred ? "unstar" : "star"}></wy-icon>
              ${this.starred ? msg("Unstar") : msg("Star")}
            </wy-dropdown-item>
            ${this.room
              ? html`<wy-dropdown-item @click=${() => this.handleLeaveConversation()}>
                  <wy-icon name="account-minus"></wy-icon>
                  ${msg("Leave conversation")}
                </wy-dropdown-item>`
              : nothing}
          </wy-dropdown>
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
