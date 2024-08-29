import { LitElement, css, html, nothing } from "lit";
import { customElement, property } from "lit/decorators.js";
import { repeat } from "lit/directives/repeat.js";
import { keyed } from "lit/directives/keyed.js";
import type { MessageType, MessagesResultType } from "../types/messages.types";
import type { InfiniteData } from "@tanstack/query-core";
import { type ConversationType, ConversationTypeGuid } from "../types/conversations.types";
import { localized, msg } from "@lit/localize";
import type { MembersResultType } from "../types/members.types";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";

import chatCss from "../scss/all.scss";
import "./wy-message";

@customElement("wy-messages")
@localized()
export default class WyMessages extends BlockConsumerMixin(LitElement) {
  static override styles = [
    chatCss,
    css`
      :host(wy-messages) {
        display: contents;
      }
      wy-message {
        scroll-margin-block: 6rem;
      }
    `,
  ];

  protected exportParts = new ShadowPartsController(this);

  @property({ attribute: false })
  conversation?: ConversationType;

  @property({ attribute: false })
  infiniteMessages!: InfiniteData<MessagesResultType, unknown>;

  @property({ type: Number })
  dataUpdatedAt: number = NaN;

  @property({ attribute: false })
  members?: MembersResultType;

  @property({ attribute: false })
  unreadMarkerId?: number;

  @property({ attribute: false })
  unreadMarkerPosition?: "above" | "below";

  @property({ attribute: false })
  unreadMarkerShow: boolean = true;

  private dispatchVote(id: number, parentId: number) {
    const event = new CustomEvent("vote", { detail: { id: id, parentId: parentId, parentType: "messages" } });
    return this.dispatchEvent(event);
  }

  override render() {
    const flattenedPages = this.infiniteMessages?.pages
      .flatMap((messageResult) => messageResult.data)
      .filter((x) => x) as MessageType[];

    let lastDate: Date;

    return html`
      <div class="wy-messages">
        <slot name="start"></slot>
        <!-- this.user ?? -->
        ${flattenedPages && this.conversation && this.user
          ? repeat(
              flattenedPages,
              (message) => message.id,
              (message, index) => {
                const messageDate = new Date(message.created_at);

                let dateContent = html``;
                if (lastDate?.toDateString() !== messageDate.toDateString()) {
                  const messageDateShort = new Intl.DateTimeFormat(this.weavyContext?.locale, {
                    dateStyle: "short",
                  }).format(messageDate);
                  lastDate = messageDate;
                  dateContent = html`<div class="wy-date-separator"><time>${messageDateShort}</time></div>`;
                }

                let unreadMarkerContent = html``;
                if (this.unreadMarkerId && this.unreadMarkerId === message.id) {
                  unreadMarkerContent = html`<div
                    id="unread-marker"
                    class="wy-toast wy-toast-action wy-fade ${this.unreadMarkerShow ? "wy-show" : ""}"
                    tabindex=${this.unreadMarkerShow ? 0 : -1}
                    @click=${() => {
                      let selector = `#message-${this.unreadMarkerId}`;
                      if (this.unreadMarkerPosition === "below") {
                        selector += "~ wy-message";
                      }
                      this.renderRoot.querySelector(selector)?.scrollIntoView({
                        block: "start",
                        inline: "nearest",
                        behavior: "smooth",
                      });
                    }}
                    @keydown=${clickOnEnterAndConsumeOnSpace}
                    @keyup=${clickOnSpace}
                  >
                    ${msg("New messages")}
                  </div>`;
                }

                return html`${[
                  html`${dateContent}`,
                  html`${this.unreadMarkerPosition === "above" ? unreadMarkerContent : nothing}`,
                  keyed(
                    `message-${message.id}`,
                    html`<wy-message
                      id="message-${message.id}"
                      .conversation=${this.conversation}
                      .messageId=${message.id}
                      .me=${message.created_by.id === this.user?.id}
                      .isBot=${message.created_by.is_bot || false}
                      .isPrivateChat=${this.conversation?.type === ConversationTypeGuid.PrivateChat ||
                      this.conversation?.type === ConversationTypeGuid.BotChat}
                      .temp=${message.temp}
                      .displayName=${message.created_by.display_name}
                      .avatar=${message.created_by.avatar_url}
                      .createdAt=${message.created_at}
                      .text=${message.plain}
                      .html=${message.html}
                      .attachments=${message.attachments?.data}
                      .meeting=${message.meeting}
                      .pollOptions=${message.options?.data}
                      .embed=${message.embed}
                      .reactions=${message.reactions?.data}
                      .sent=${this.members &&
                      index === flattenedPages.length - 1 &&
                      message.created_by.id === this.user?.id
                        ? !message.temp
                          ? true
                          : false
                        : null}
                      .delivered=${this.members &&
                      index === flattenedPages.length - 1 &&
                      (this.members.data ?? []).filter(
                        (m) => m.id !== this.user?.id && m.delivered_at! > message.created_at
                      ).length > 0}
                      .seenBy=${this.members && this.members.data && this.members.data.length > 0
                        ? this.members.data.filter((member) => {
                            return member.marked_id === message.id && member.id !== this.user?.id;
                          })
                        : []}
                      @vote=${(e: CustomEvent) => {
                        this.dispatchVote(e.detail.id, e.detail.parentId);
                      }}
                    ></wy-message>`
                  ),
                  html`${this.unreadMarkerPosition === "below" ? unreadMarkerContent : nothing}`,
                ]}`;
              }
            )
          : nothing}

        <slot name="end"></slot>
      </div>
    `;
  }
}
