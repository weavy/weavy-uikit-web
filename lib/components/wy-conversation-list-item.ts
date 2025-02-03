import { LitElement, html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { classMap } from "lit/directives/class-map.js";
import { consume } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import chatCss from "../scss/all.scss";
import type { MessageType } from "../types/messages.types";
import type { UserType } from "../types/users.types";
import { type MembersResultType } from "../types/members.types";
import { localized, msg } from "@lit/localize";
import { relativeTime } from "../utils/datetime";
import { ifDefined } from "lit/directives/if-defined.js";
import { RealtimeAppMarkedEventType, RealtimeMessageEventType } from "../types/realtime.types";
import { WeavyProps } from "../types/weavy.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { UserContext } from "../contexts/user-context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { updateCacheItem, updateCacheItems } from "../utils/query-cache";
import { AppType, AppTypeGuid } from "../types/app.types";

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

  @consume({ context: WeavyContext, subscribe: true })
  @state()
  private weavy?: WeavyType;

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
  type: AppTypeGuid = AppTypeGuid.PrivateChat;

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

  @consume({ context: UserContext, subscribe: true })
  @state()
  user: UserType | undefined;

  private handleMessageCreated = (realtimeEvent: RealtimeMessageEventType) => {
    if (!this.user || !this.weavy) {
      return;
    }

    updateCacheItem(
      this.weavy.queryClient,
      ["apps", realtimeEvent.message.app.id],
      undefined,
      (item: AppType) => {
        item.last_message = realtimeEvent.message;
        item.is_unread = realtimeEvent.message.created_by.id !== this.user?.id;
      }
    );

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

  private handleConversationUpdated = () => {
    this.weavy?.queryClient.invalidateQueries({ queryKey: ["apps"], exact: false });
  };

  private handleConversationMarked = (realtimeEvent: RealtimeAppMarkedEventType) => {
    if (!this.user) {
      return;
    }

    if (realtimeEvent.actor.id === this.user.id) {
      this.weavy?.queryClient.invalidateQueries({ queryKey: ["apps"], exact: false });
    }
  };

  private dispatchSelected(e: Event, id: number) {
    e.preventDefault();
    const event = new CustomEvent("selected", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  private handleStar(e: Event, star: boolean) {
    const event = new CustomEvent("star", {
      detail: { id: this.conversationId, star: star },
    });
    return this.dispatchEvent(event);
  }

  private handlePin(e: Event, pin: boolean) {
    const event = new CustomEvent("pin", {
      detail: { id: this.conversationId, pin: pin },
    });
    return this.dispatchEvent(event);
  }

  private dispatchMarked(mark: boolean) {
    const event = new CustomEvent("mark", {
      detail: { id: this.conversationId, messageId: mark ? this.lastMessage?.id : null },
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

  #unsubscribeToRealtime?: () => void;

  override willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>) {
    if (changedProperties.has("weavy") && this.weavy) {
      this.#unsubscribeToRealtime?.();

      // realtime
      const subscribeGroup = `a${this.conversationId}`;

      this.weavy.subscribe(subscribeGroup, "app_updated", this.handleConversationUpdated);
      this.weavy.subscribe(subscribeGroup, "member_added", this.handleConversationUpdated);
      this.weavy.subscribe(subscribeGroup, "message_created", this.handleMessageCreated);
      this.weavy.subscribe(subscribeGroup, "app_marked", this.handleConversationMarked);

      this.#unsubscribeToRealtime = () => {
        this.weavy?.unsubscribe(subscribeGroup, "app_updated", this.handleConversationUpdated);
        this.weavy?.unsubscribe(subscribeGroup, "member_added", this.handleConversationUpdated);
        this.weavy?.unsubscribe(subscribeGroup, "message_created", this.handleMessageCreated);
        this.weavy?.unsubscribe(subscribeGroup, "app_marked", this.handleConversationMarked);
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
      <div
        class=${classMap({
          "wy-item wy-list-item-lg wy-item-hover wy-conversation": true,
          "wy-unread": this.unread,
          "wy-active": this.selected,
        })}
        tabindex="0"
        @click=${(e: Event) => this.dispatchSelected(e, this.conversationId)}
        @keydown=${clickOnEnterAndConsumeOnSpace}
        @keyup=${clickOnSpace}
      >
        ${this.type !== AppTypeGuid.BotChat
          ? this.avatarUrl
            ? html`<wy-avatar .size=${48} src=${this.avatarUrl}></wy-avatar>`
            : this.type == AppTypeGuid.ChatRoom
            ? html` <wy-avatar-group
                .members=${this.members?.data}
                title=${this.displayName}
                .size=${48}
              ></wy-avatar-group>`
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
                        ? html`<wy-icon kind="text-icon" name="video"></wy-icon>`
                        : nothing}
                      ${!this.lastMessage ? html`&nbsp;` : nothing}
                    </wy-typing>
                  `
                : nothing}
            </div>

            <div class="wy-item-actions wy-item-actions-bottom">
              ${this.starred
                ? html`<wy-button
                    kind="icon"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.handleStar(e, false);
                    }}
                  >
                    <wy-icon name="star" size=${24} color="yellow"></wy-icon>
                  </wy-button>`
                : nothing}
              ${this.pinned
                ? html`<wy-button
                    kind="icon"
                    @click=${(e: Event) => {
                      e.stopPropagation();
                      this.handlePin(e, false);
                    }}
                  >
                    <wy-icon name="pin" size=${24} color=""></wy-icon>
                  </wy-button>`
                : nothing}

              <wy-dropdown directionX="left">
                <wy-dropdown-item @click=${() => this.dispatchMarked(this.unread)}>
                  <wy-icon name=${this.unread ? "read" : "unread"}></wy-icon>
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
                ${this.type === AppTypeGuid.ChatRoom
                  ? html`<wy-dropdown-item @click=${() => this.handleLeaveConversation()}>
                      <wy-icon name="account-minus"></wy-icon>
                      ${msg("Leave conversation")}
                    </wy-dropdown-item>`
                  : nothing}
                ${this.type === AppTypeGuid.BotChat
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
