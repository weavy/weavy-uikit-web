import { html, type PropertyValues, nothing } from "lit";
import { customElement, state } from "lit/decorators.js";
import { AccessType } from "../types/app.types";
import { ConversationTypeGuid, type ConversationType } from "../types/conversations.types";
import { Feature } from "../types/features.types";
import type { MemberType, MembersResultType } from "../types/members.types";
import { getMemberOptions } from "../data/members";
import { updateCacheItem } from "../utils/query-cache";
import { localized, msg } from "@lit/localize";
import { hasFeature } from "../utils/features";
import { ifDefined } from "lit/directives/if-defined.js";
import type {
  RealtimeAppEventType,
  RealtimeConversationDeliveredEventType,
  RealtimeConversationMarkedEventType,
} from "../types/realtime.types";
import { WeavyContextProps } from "../types/weavy.types";
import { hasAccess } from "../utils/access";

import WyConversation from "./wy-conversation";
import "./wy-empty";
import "./wy-messages";
import "./wy-message-editor";
import "./wy-spinner";
import { QueryController } from "../controllers/query-controller";

@customElement("wy-conversation-extended")
@localized()
export default class WyConversationExtended extends WyConversation {
  @state()
  protected conversationTitle: string = "";

  membersQuery = new QueryController<MembersResultType>(this);

  isPrivateChat(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.PrivateChat;
  }

  isChatRoom(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.ChatRoom;
  }

  private handleRealtimeAppUpdated = (realtimeEvent: RealtimeAppEventType) => {
    if (!this.conversation || realtimeEvent.app.id !== this.conversation.id) {
      return;
    }

    this.conversationTitle = realtimeEvent.app.display_name;
  };

  private handleRealtimeSeenBy = (realtimeEvent: RealtimeConversationMarkedEventType) => {
    if (!this.weavyContext || !this.conversation || realtimeEvent.conversation.id !== this.conversation.id) {
      return;
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["members", this.conversation.id],
      realtimeEvent.actor.id,
      (item: MemberType) => {
        item.marked_id = realtimeEvent.marked_id;
        item.marked_at = realtimeEvent.marked_at;
      }
    );
  };

  private handleRealtimeDelivered = (realtimeEvent: RealtimeConversationDeliveredEventType) => {
    if (
      !this.weavyContext ||
      !this.conversation ||
      realtimeEvent.actor.id === this.user!.id ||
      realtimeEvent.conversation.id !== this.conversation!.id
    ) {
      return;
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["members", this.conversation.id],
      realtimeEvent.actor.id,
      (item: MemberType) => {
        item.delivered_at = realtimeEvent.delivered_at;
      }
    );
  };

  protected override unsubscribeToRealtime(conversationId: number) {
    super.unsubscribeToRealtime(conversationId);

    if (!this.weavyContext) {
      return;
    }

    //console.log("unsubscribing conversation realtime", conversation.id);
    this.weavyContext.unsubscribe(`a${conversationId}`, "conversation_marked", this.handleRealtimeSeenBy);
    this.weavyContext.unsubscribe(`a${conversationId}`, "app_updated", this.handleRealtimeAppUpdated);
    this.weavyContext.unsubscribe(`a${conversationId}`, "conversation_delivered", this.handleRealtimeDelivered);
  }

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavyContext") || changedProperties.has("conversation")) && this.weavyContext) {
      // conversation object is updated
      if (changedProperties.has("conversation") && this.conversation) {
        this.conversationTitle = this.conversation.display_name;
      }

      if (!this.conversation) {
        //console.log("no more conversation")
        this.membersQuery.untrackQuery();
      }
    }

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("conversationId")) &&
      this.weavyContext &&
      this.conversationId !== changedProperties.get("conversationId")
    ) {
      if (this.conversationId && hasFeature(this.availableFeatures, Feature.Receipts, this.features?.receipts)) {
        this.membersQuery.trackQuery(
          getMemberOptions(this.weavyContext, this.conversationId, {
            initialData: () => {
              // Use any data from the conversation query as the initial data for the member query
              if (this.conversation?.id) {
                return this.weavyContext?.queryClient.getQueryData<ConversationType>([
                  "conversations",
                  this.conversation.id,
                ])?.members;
              }
              return undefined;
            },
          })
        );
      } else {
        this.membersQuery.untrackQuery();
      }

      if (this.conversationId) {
        this.weavyContext.subscribe(`a${this.conversationId}`, "app_updated", this.handleRealtimeAppUpdated);
        this.weavyContext.subscribe(`a${this.conversationId}`, "conversation_marked", this.handleRealtimeSeenBy);
        this.weavyContext.subscribe(`a${this.conversationId}`, "conversation_delivered", this.handleRealtimeDelivered);
      }
    }
  }

  override render() {
    const { isPending: networkIsPending } = this.weavyContext?.network ?? { isPending: true };
    const { data: infiniteData, isPending, hasNextPage } = this.messagesQuery.result ?? { isPending: networkIsPending };
    const { data: membersData, isPending: membersIsPending } = this.membersQuery.result ?? {};

    const otherMember =
      this.user && this.isPrivateChat()
        ? (this.conversation?.members?.data || []).filter((member) => member.id !== this.user?.id)?.[0]
        : null;

    return html`
      ${this.conversation && this.user && infiniteData
        ? html`
            ${!hasNextPage && !isPending
              ? html`
                  <div class="wy-avatar-header">
                    ${this.isChatRoom() && !this.conversation.avatar_url
                      ? html`
                          <wy-avatar-group
                            .members=${membersData}
                            .user=${this.user}
                            .name=${this.conversation.display_name}
                            .size=${96}
                          ></wy-avatar-group>
                        `
                      : this.conversation.display_name || this.conversation.avatar_url
                      ? html`
                          <wy-avatar
                            src=${ifDefined(otherMember?.avatar_url)}
                            name=${this.conversation.display_name}
                            ?isBot=${otherMember?.is_bot}
                            size=${96}
                          ></wy-avatar>
                        `
                      : nothing}
                    ${this.conversationTitle ? html` <h3 class="wy-title">${this.conversationTitle}</h3> ` : nothing}
                  </div>
                `
              : nothing}
            <wy-messages
              .app=${this.conversation}
              .user=${this.user}
              .infiniteMessages=${infiniteData}
              .availableFeatures=${this.availableFeatures}
              .features=${this.features}
              .members=${membersData}
              .unreadMarkerId=${this.lastReadMessageId}
              .unreadMarkerPosition=${this.lastReadMessagePosition}
              .unreadMarkerShow=${this.lastReadMessageShow}
              .pagerRef=${this.pagerRef}
              @vote=${(e: CustomEvent) => {
                this.pollMutation?.mutate({
                  optionId: e.detail.id,
                  parentType: e.detail.parentType,
                  parentId: e.detail.parentId,
                });
              }}
            ></wy-messages>
          `
        : html`
            <div class="wy-messages">
              <wy-empty class="wy-pane">
                ${isPending || membersIsPending || !this.user || !this.conversation
                  ? html`<wy-spinner overlay></wy-spinner>`
                  : msg("Start the conversation!")}
              </wy-empty>
            </div>
          `}
      ${this.conversation && hasAccess(AccessType.Write, this.conversation?.access, this.conversation?.permissions)
        ? html`
            <div class="wy-footerbar wy-footerbar-sticky">
              <wy-message-editor
                .app=${this.conversation}
                .user=${this.user}
                .availableFeatures=${this.availableFeatures}
                .features=${this.features}
                .draft=${true}
                placeholder=${msg("Type a message...")}
                @submit=${(e: CustomEvent) => this.handleSubmit(e)}
              ></wy-message-editor>
            </div>
          `
        : nothing}
    `;
  }
}
