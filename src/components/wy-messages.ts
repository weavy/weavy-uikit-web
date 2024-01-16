import { LitElement, css, html, nothing } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { type Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";

import type { MessagesResultType } from "../types/messages.types";

import type { InfiniteData } from "@tanstack/query-core";
import type { UserType } from "../types/users.types";
import type { FeaturesConfigType, FeaturesListType } from "../types/features.types";

import chatCss from "../scss/all.scss";
import { type AppType } from "../types/app.types";
import { localized, msg } from "@lit/localize";
import type { MembersResultType } from "../types/members.types";

import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import "./wy-message";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "src/utils/keyboard";

@customElement("wy-messages")
@localized()
export default class WyMessages extends LitElement {
  static override styles = [
    chatCss,
    css`
      :host(wy-messages) {
        display: contents;
      }
    `,
  ];

  _chatRoomId = "edb400ac-839b-45a7-b2a8-6a01820d1c44";

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @property({ attribute: false })
  app!: AppType;

  @property({ attribute: false })
  infiniteMessages!: InfiniteData<MessagesResultType, unknown>;

  @property({ type: Number })
  dataUpdatedAt: number = NaN;

  @property({ attribute: false })
  user!: UserType;

  @property({ attribute: false })
  members?: MembersResultType;

  @property({ attribute: false })
  availableFeatures?: FeaturesListType;

  @property({ attribute: false })
  features?: FeaturesConfigType;

  @property({ attribute: false })
  unreadMarkerId?: number;

  @property({ attribute: false })
  unreadMarkerPosition?: "top" | "bottom";

  @property({ attribute: false })
  pagerRef: Ref<Element> = createRef();

  dispatchScrollToBottom() {
    const event = new CustomEvent("scroll-to-bottom");
    return this.dispatchEvent(event);
  }

  protected override createRenderRoot(): HTMLElement | DocumentFragment {
    return this;
  }

  override render() {
    const flattenedPages = this.infiniteMessages?.pages.flatMap((messageResult) => messageResult.data);

    let lastDate: Date;

    return html`
      <div class="wy-messages">
        <div ${ref(this.pagerRef)} class="wy-pager"></div>
        <!-- this.user ?? -->
        ${flattenedPages
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
                    class="wy-toast wy-toast-action"
                    tabindex="0"
                    @click=${() => this.dispatchScrollToBottom()}
                    @keydown=${clickOnEnterAndConsumeOnSpace}
                    @keyup=${clickOnSpace}
                  >
                    ${msg("New messages")}
                  </div>`;
                }

                return [
                  html`${dateContent}`,
                  html`${this.unreadMarkerPosition === "top" ? unreadMarkerContent : nothing}`,
                  html`<wy-message
                    id="message-${message.id}"
                    .app=${this.app}
                    .messageId=${message.id}
                    .me=${message.created_by.id === this.user.id}
                    .chatRoom=${this.app?.type === this._chatRoomId}
                    .temp=${message.temp}
                    .displayName=${message.created_by.display_name}
                    .avatar=${message.created_by.avatar_url}
                    .createdAt=${message.created_at}
                    .text=${message.plain}
                    .html=${message.html}
                    .attachments=${message.attachments}
                    .meeting=${message.meeting}
                    .embed=${message.embed}
                    .reactions=${message.reactions}
                    .userId=${this.user.id}
                    .availableFeatures=${this.availableFeatures}
                    .features=${this.features}
                    .sent=${this.members &&
                    index === flattenedPages.length - 1 &&
                    message.created_by.id === this.user.id
                      ? !message.temp
                        ? true
                        : false
                      : null}
                    .delivered=${this.members &&
                    index === flattenedPages.length - 1 &&
                    this.members.data.filter((m) => m.id !== this.user.id && m.delivered_at! > message.created_at)
                      .length > 0}
                    .seenBy=${this.members && this.members.data && this.members.data.length > 0
                      ? this.members.data.filter((member) => {
                          return member.marked_id === message.id && member.id !== this.user.id;
                        })
                      : []}
                  ></wy-message>`,
                  html`${this.unreadMarkerPosition === "bottom" ? unreadMarkerContent : nothing}`,
                ];
              }
            )
          : nothing}
      </div>
    `;
  }
}
