import { html, type PropertyValues, nothing } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { state } from "lit/decorators.js";
import type { MemberType } from "../types/members.types";
import { updateCacheItem } from "../utils/query-cache";
import { localized, msg } from "@lit/localize";
import { ifDefined } from "lit/directives/if-defined.js";
import type { RealtimeAppEventType, RealtimeAppMarkedEventType } from "../types/realtime.types";
import { WeavyProps } from "../types/weavy.types";
import { hasPermission } from "../utils/permission";
import { ref } from "lit/directives/ref.js";
import { PermissionType } from "../types/app.types";

import WyConversation from "./wy-conversation";
import "./wy-empty";
import "./wy-messages";
import "./wy-editor-message";
import "./wy-message-typing";
import "./wy-spinner";

@customElement("wy-conversation-extended")
@localized()
export default class WyConversationExtended extends WyConversation {
  @state()
  protected conversationTitle: string = "";

  private handleRealtimeAppUpdated = (realtimeEvent: RealtimeAppEventType) => {
    if (!this.conversation || realtimeEvent.app.id !== this.conversation.id) {
      return;
    }

    this.conversationTitle = realtimeEvent.app.display_name;
  };

  private handleRealtimeMarked = (realtimeEvent: RealtimeAppMarkedEventType) => {
    if (!this.weavy || !this.conversation) {
      return;
    }

    updateCacheItem(
      this.weavy.queryClient,
      ["members", this.conversation.id],
      realtimeEvent.actor.id,
      (item: MemberType) => {
        item.marked_id = realtimeEvent.marked_id;
        item.marked_at = realtimeEvent.marked_at;
      }
    );
  };

  #unsubscribeToRealtime?: () => void;

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyProps>) {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavy") || changedProperties.has("conversation")) && this.weavy) {
      // conversation object is updated
      if (changedProperties.has("conversation") && this.conversation) {
        this.conversationTitle = this.conversation.display_name;
      }
    }

    if (
      (changedProperties.has("weavy") || changedProperties.has("conversationId")) &&
      this.weavy &&
      this.conversationId !== changedProperties.get("conversationId")
    ) {
      this.#unsubscribeToRealtime?.();

      if (this.conversationId) {
        const subscribeGroup = `a${this.conversationId}`;

        this.weavy.subscribe(subscribeGroup, "app_updated", this.handleRealtimeAppUpdated);
        this.weavy.subscribe(subscribeGroup, "app_marked", this.handleRealtimeMarked);

        this.#unsubscribeToRealtime = () => {
          this.weavy?.unsubscribe(subscribeGroup, "app_marked", this.handleRealtimeMarked);
          this.weavy?.unsubscribe(subscribeGroup, "app_updated", this.handleRealtimeAppUpdated);
          this.#unsubscribeToRealtime = undefined;
        };
      }
    }
  }

  override render() {
    const { data: infiniteData, isPending: messagesIsPending, hasNextPage } = this.messagesQuery.result ?? {};
    const { data: membersData, isPending: membersIsPending } = this.membersQuery.result ?? {};

    const otherMember =
      this.user && this.isPrivateChat()
        ? (this.conversation?.members?.data || []).filter((member) => member.id !== this.user?.id)?.[0] ?? this.user
        : null;

    return html`
      ${this.conversation && infiniteData
        ? html`
            ${!hasNextPage && !messagesIsPending
              ? html`
                  <wy-avatar-header>
                    ${this.conversation.avatar_url
                      ? html`<wy-avatar .size=${96} src=${this.conversation.avatar_url}></wy-avatar>`
                      : this.isChatRoom()
                      ? html` <wy-avatar-group
                          .members=${membersData?.data}
                          title=${this.conversation.display_name}
                          .size=${96}
                        ></wy-avatar-group>`
                      : otherMember?.avatar_url
                      ? html`
                          <wy-avatar
                            src=${ifDefined(otherMember?.avatar_url)}
                            name=${this.conversation.display_name}
                            ?isBot=${otherMember?.is_bot}
                            size=${96}
                          ></wy-avatar>
                        `
                      : nothing}
                  </wy-avatar-header>
                `
              : nothing}
            <wy-messages
              .conversation=${this.conversation}
              .infiniteMessages=${infiniteData}
              .members=${membersData}
              .unreadMarkerId=${this.lastReadMessageId}
              .unreadMarkerPosition=${this.lastReadMessagePosition}
              .unreadMarkerShow=${this.showNewMessages}
              @vote=${(e: CustomEvent) => {
                this.pollMutation?.mutate({
                  optionId: e.detail.id,
                  parentType: e.detail.parentType,
                  parentId: e.detail.parentId,
                });
              }}
            >
              ${hasNextPage ? html`<div slot="start" ${ref(this.pagerRef)} part="wy-pager wy-pager-top"></div>` : nothing}
              <wy-message-typing
                slot="end"
                .conversationId=${this.conversation.id}
                .userId=${this.user?.id}
                .isPrivateChat=${this.isPrivateChat()}
                .members=${this.conversation.members.data}
                @typing=${(e: CustomEvent) => this.handleTyping(e)}
              ></wy-message-typing>
            </wy-messages>
          `
        : html`
            <div class="wy-messages">
              <wy-empty class="wy-pane">
                ${messagesIsPending || membersIsPending || !this.conversation
                  ? html`<wy-spinner overlay></wy-spinner>`
                  : msg("Start the conversation!")}
              </wy-empty>
            </div>
          `}
      ${this.conversation
        ? html`
            <div ${ref(this.bottomRef)}></div>
            <div class="wy-footerbar wy-footerbar-sticky">
              <wy-message-editor
                .app=${this.conversation}
                .draft=${true}
                placeholder=${msg("Type a message...")}
                ?disabled=${!hasPermission(PermissionType.Create, this.conversation?.permissions)}
                @submit=${(e: CustomEvent) => this.handleSubmit(e)}
              ></wy-message-editor>
            </div>
          `
        : nothing}
    `;
  }

  override disconnectedCallback() {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
