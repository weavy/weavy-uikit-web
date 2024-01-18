import { LitElement, html, type PropertyValues, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ContextConsumer } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { portal } from "lit-modal-portal";
import { ConversationTypes, type ConversationType } from "../types/app.types";
import type {
  MessageMutationContextType,
  MessageType,
  MessagesResultType,
  MutateMessageProps,
} from "../types/messages.types";
import type { UserType } from "../types/users.types";
import { Feature, type FeaturesConfigType, type FeaturesListType } from "../types/features.types";
import type { MemberType, MembersResultType } from "../types/members.types";

import { getApiOptions } from "../data/api";
import { getMessagesOptions, getAddMessageMutationOptions } from "../data/messages";
import { getMemberOptions } from "../data/members";

import { InfiniteQueryController } from "../controllers/infinite-query-controller";

import { ReverseInfiniteScrollController } from "../controllers/infinite-scroll-controller";

import { MutationController } from "../controllers/mutation-controller";
import { QueryController } from "../controllers/query-controller";

import { isParentAtBottom, scrollParentToBottom } from "../utils/scroll-position";
import { addCacheItem, keepFirstPage, updateCacheItem } from "../utils/query-cache";

import chatCss from "../scss/all.scss";

import "./wy-empty";
import "./wy-typing";
import "./wy-presence";
import "./wy-message";
import "./wy-messages";
import "./wy-message-editor";
import "./wy-users-search";
import "./wy-overlay";
import "./wy-spinner";

import { localized, msg } from "@lit/localize";
import {
  AddMembersToConversationMutationType,
  LeaveConversationMutationType,
  MarkConversationMutationType,
  UpdateConversationMutationType,
  getAddMembersToConversationMutation,
  getLeaveConversationMutation,
  getMarkConversationMutation,
  getUpdateConversationMutation,
} from "../data/conversation";
import { Ref, createRef } from "lit/directives/ref.js";
import { hasFeature } from "../utils/features";
import { ifDefined } from "lit/directives/if-defined.js";
import { inputConsumeWithBlurOnEscape } from "../utils/keyboard";
import type {
  RealtimeAppEventType,
  RealtimeConversationDeliveredEventType,
  RealtimeConversationMarkedEventType,
  RealtimeMessageEventType,
  RealtimeReactionEventType,
} from "../types/realtime.types";
import { whenParentsDefined } from "../utils/dom";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-conversation")
@localized()
export default class WyConversation extends LitElement {
  static override styles = [
    chatCss,
    css`
      :host {
        display: contents;
        position: relative;
      }

      wy-messages {
        display: contents;
      }
    `,
  ];

  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContext }, this>;

  // Manually consumed in performUpdate()
  @state()
  protected weavyContext?: WeavyContext;

  @property({ attribute: false })
  user?: UserType;

  @property({ attribute: false })
  conversation?: ConversationType;

  @state()
  lastReadMessageId?: number;

  @state()
  lastReadMessagePosition: "top" | "bottom" = "bottom";

  @property()
  cssClass?: string;

  @state()
  availableFeatures?: FeaturesListType;

  @property({ type: Object })
  features: FeaturesConfigType = {};

  @state()
  protected showAddMembers: boolean = false;

  @state()
  protected showDetails: boolean = false;

  @state()
  protected conversationTitle: string = "";

  @state()
  protected conversationTitleInput: string = "";

  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  isContextualChat(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypes.ContextualChat;
  }

  isPrivateChat(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypes.PrivateChat;
  }

  isChatRoom(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypes.ChatRoom;
  }

  messagesQuery = new InfiniteQueryController<MessagesResultType>(this);
  membersQuery = new QueryController<MembersResultType>(this);
  userQuery = new QueryController<UserType>(this);
  featuresQuery = new QueryController<FeaturesListType>(this);

  private markConversationMutation?: MarkConversationMutationType;
  private addMembersMutation?: AddMembersToConversationMutationType;
  private leaveConversationMutation?: LeaveConversationMutationType;
  private updateConversationMutation?: UpdateConversationMutationType;

  private addMessageMutation = new MutationController<
    MessageType,
    Error,
    MutateMessageProps,
    MessageMutationContextType
  >(this);

  private infiniteScroll = new ReverseInfiniteScrollController(this);

  private pagerRef: Ref<Element> = createRef();

  private wasAtBottom = true;

  override async performUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.performUpdate();
  }

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if ((changedProperties.has("weavyContext") || changedProperties.has("conversation")) && this.weavyContext) {
      const lastConversation = changedProperties.get("conversation");

      // if context updated
      if (changedProperties.has("weavyContext")) {
        this.userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));
        this.featuresQuery.trackQuery(getApiOptions<FeaturesListType>(this.weavyContext, ["features", "chat"]));

        if (!this.isContextualChat()) {
          this.markConversationMutation = getMarkConversationMutation(this.weavyContext);
          this.leaveConversationMutation = getLeaveConversationMutation(this.weavyContext);
          this.addMembersMutation = getAddMembersToConversationMutation(this.weavyContext);
          this.updateConversationMutation = getUpdateConversationMutation(this.weavyContext);
        }
      }

      // conversation object is updated
      if (changedProperties.has("conversation") && this.conversation) {
        if (!this.isContextualChat()) {
          this.conversationTitleInput = this.conversationTitle = this.conversation.display_name;
        }

        this.messagesQuery.trackInfiniteQuery(getMessagesOptions(this.weavyContext, this.conversation.id));
        this.addMessageMutation.trackMutation(
          getAddMessageMutationOptions(this.weavyContext, ["messages", this.conversation.id])
        );

        if (!this.isContextualChat() && this.conversation.last_message) {
          this.markConversationMutation?.mutate({
            id: this.conversation.id,
            markAsRead: true,
            messageId: this.conversation.last_message?.id,
          });
        }

        // Always scroll to bottom when conversation changed
        if (this.conversation.id !== lastConversation?.id) {
          this.wasAtBottom = true;
        }
      }

      // conversation id is changed
      if (lastConversation && this.conversation && lastConversation.id !== this.conversation.id) {
        this.unsubscribeToRealtime(lastConversation);
      }

      if (!this.conversation) {
        this.messagesQuery.untrackInfiniteQuery();
        this.addMessageMutation.untrackMutation();
        this.membersQuery.untrackQuery();
      }
    } else {
      // Check state for scrollParentToBottom
      this.wasAtBottom = this.isAtBottom;
    }

    if (!this.userQuery.result?.isPending) {
      this.user = this.userQuery.result?.data;
    }

    if (!this.featuresQuery.result?.isPending) {
      this.availableFeatures = this.featuresQuery.result?.data;
    }

    // if conversation id is updated and user is set
    if (
      (changedProperties.has("weavyContext") ||
        changedProperties.has("conversation") ||
        changedProperties.has("user")) &&
      this.weavyContext &&
      this.conversation &&
      this.user
    ) {
      if (!this.isContextualChat()) {
        if (hasFeature(this.availableFeatures, Feature.Receipts, this.features?.receipts)) {
          this.membersQuery.trackQuery(getMemberOptions(this.weavyContext, this.conversation.id));
        }
      }

      // set unread messages banner
      this.lastReadMessageId =
        !this.isContextualChat() && this.conversation.is_unread
          ? (this.conversation?.members?.data || []).filter((member) => member.id === this.user?.id)?.[0]?.marked_id
          : undefined;
      this.lastReadMessagePosition = "bottom";
    }

    if (
      (changedProperties.has("weavyContext") || changedProperties.has("conversation")) &&
      this.weavyContext &&
      (this.conversation && this.conversation.id !== changedProperties.get("conversation")?.id)
    ) {
      //console.log("subscribing conversation realtime", this.conversation.id);
      // realtime
      this.weavyContext.subscribe(`a${this.conversation.id}`, "message_created", this.handleRealtimeMessage);
      this.weavyContext.subscribe(`a${this.conversation.id}`, "reaction_added", this.handleRealtimeReactionAdded);
      this.weavyContext.subscribe(`a${this.conversation.id}`, "reaction_removed", this.handleRealtimeReactionDeleted);

      if (!this.isContextualChat()) {
        this.weavyContext.subscribe(`a${this.conversation.id}`, "app_updated", this.handleRealtimeAppUpdated);
        this.weavyContext.subscribe(`a${this.conversation.id}`, "conversation_marked", this.handleRealtimeSeenBy);
        this.weavyContext.subscribe(null, "conversation_delivered", this.handleRealtimeDelivered);
      }
    }
  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.messagesQuery.result, this.pagerRef.value);
  }

  override updated() {
    if (this.wasAtBottom) {
      requestAnimationFrame(() => {
        this.scrollToBottom();
      });
    }
  }

  private handleSubmit(e: CustomEvent) {
    if (this.conversation && this.user) {
      this.addMessageMutation
        .mutate({
          appId: this.conversation.id,
          text: e.detail.text,
          meetingId: e.detail.meetingId,
          embed: e.detail.embed,
          blobs: e.detail.blobs,
          userId: this.user.id,
        })
        .then((data: MessageType) => {
          this.markConversationMutation?.mutate({
            id: this.conversation!.id,
            markAsRead: true,
            messageId: data.id,
          });
        });
      this.lastReadMessageId = undefined;
      requestAnimationFrame(() => {
        this.scrollToBottom();
      });
    }
  }

  handleRealtimeMessage = (realtimeEvent: RealtimeMessageEventType) => {
    if (
      !this.weavyContext ||
      !this.conversation ||
      !this.user ||
      realtimeEvent.message.app_id !== this.conversation.id ||
      realtimeEvent.message.created_by_id === this.user.id
    ) {
      return;
    }

    realtimeEvent.message.created_by = realtimeEvent.actor;
    addCacheItem(this.weavyContext.queryClient, ["messages", this.conversation.id], realtimeEvent.message);

    // mark as read
    if (!this.isContextualChat()) {
      this.markConversationMutation?.mutate({
        id: this.conversation!.id,
        markAsRead: true,
        messageId: realtimeEvent.message.id,
      });
    }

    // display toast
    if (!this.isAtBottom && !this.lastReadMessageId) {
      this.lastReadMessageId = realtimeEvent.message.id;
      this.lastReadMessagePosition = "top";
    }
  };

  handleRealtimeReactionAdded = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || !this.user || !this.conversation || realtimeEvent.actor.id === this.user.id) {
      return;
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["messages", this.conversation.id],
      realtimeEvent.entity.id,
      (item: MessageType) => {
        item.reactions = [
          ...(item.reactions || []),
          { content: realtimeEvent.reaction, created_by_id: realtimeEvent.actor.id },
        ];
      }
    );
  };

  handleRealtimeReactionDeleted = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || !this.conversation || !this.user || realtimeEvent.actor.id === this.user.id) {
      return;
    }
    updateCacheItem(
      this.weavyContext.queryClient,
      ["messages", this.conversation.id],
      realtimeEvent.entity.id,
      (item: MessageType) => {
        item.reactions = item.reactions.filter((item) => item.created_by_id !== realtimeEvent.actor.id);
      }
    );
  };

  handleRealtimeAppUpdated = (realtimeEvent: RealtimeAppEventType) => {
    if (!this.conversation || realtimeEvent.app.id !== this.conversation.id) {
      return;
    }

    this.conversationTitle = this.conversationTitleInput = realtimeEvent.app.display_name;
  };

  handleRealtimeSeenBy = (realtimeEvent: RealtimeConversationMarkedEventType) => {
    if (
      !this.weavyContext ||
      !this.conversation ||
      this.isContextualChat() ||
      realtimeEvent.conversation.id !== this.conversation.id
    ) {
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

  handleRealtimeDelivered = (realtimeEvent: RealtimeConversationDeliveredEventType) => {
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

  get isAtBottom() {
    return this.pagerRef.value ? isParentAtBottom(this.pagerRef.value) : true;
  }

  scrollToBottom() {
    if (this.weavyContext && this.conversation) {
      keepFirstPage(this.weavyContext.queryClient, ["messages", this.conversation.id]);
    }
    scrollParentToBottom(this.pagerRef.value);
  }

  private unsubscribeToRealtime(conversation: ConversationType) {
    if (!this.weavyContext) {
      return;
    }

    //console.log("unsubscribing conversation realtime", conversation.id);

    this.weavyContext.unsubscribe(`a${conversation.id}`, "message_created", this.handleRealtimeMessage);
    this.weavyContext.unsubscribe(`a${conversation.id}`, "reaction_added", this.handleRealtimeReactionAdded);
    this.weavyContext.unsubscribe(`a${conversation.id}`, "reaction_removed", this.handleRealtimeReactionDeleted);

    if (!this.isContextualChat(conversation)) {
      this.weavyContext.unsubscribe(`a${conversation.id}`, "conversation_marked", this.handleRealtimeSeenBy);
      this.weavyContext.unsubscribe(`a${conversation.id}`, "app_updated", this.handleRealtimeAppUpdated);
      this.weavyContext.unsubscribe(null, "conversation_delivered", this.handleRealtimeDelivered);
    }
  }

  private async addMembers(members: MemberType[]) {
    this.showAddMembers = false;

    if (!this.weavyContext || !this.conversation) {
      return;
    }

    // add members
    await this.addMembersMutation?.mutate({ id: this.conversation.id, members: members.map((m) => m.id) });
    await this.membersQuery.result.refetch();

    await this.weavyContext.queryClient.invalidateQueries({ queryKey: ["conversations"] });
  }

  private async handleSaveConversationName() {
    if (!this.conversation) {
      return;
    }
    const title = this.conversationTitleInput.trim() === "" ? null : this.conversationTitleInput.trim();
    await this.updateConversationMutation?.mutate({ id: this.conversation.id, title: title });

    //this.conversationTitle = conversation?.display_name || "";
  }

  private async leaveConversation(memberId?: number) {
    if (!this.weavyContext || !this.conversation || !this.user) {
      return;
    }

    await this.leaveConversationMutation?.mutate({
      id: this.conversation.id,
      members: [memberId || this.user.id],
    });

    if (!memberId) {
      this.showDetails = false;
      this.conversation = undefined;
    } else {
      await this.membersQuery.result.refetch();
    }

    await this.weavyContext.queryClient.invalidateQueries({ queryKey: ["conversations"] });
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
      <div class="wy-messenger-conversation wy-scroll-y">
        ${this.conversation && !this.isContextualChat()
          ? html`
              <header class="wy-appbars">
                <nav class="wy-appbar">
                  <div><slot name="action"></slot></div>
                  ${this.availableFeatures && this.conversation && this.user
                    ? html`
                        <wy-typing appId=${this.conversation?.id} userId=${this.user.id}>
                          ${this.conversation.type === ConversationTypes.PrivateChat
                            ? html`<wy-presence
                                placement="text"
                                .status=${otherMember?.presence}
                                id=${ifDefined(otherMember?.id)}
                              ></wy-presence>`
                            : nothing}
                          <span class="wy-appbar-text">${this.conversationTitle}</span>
                        </wy-typing>
                      `
                    : html`<span></span>`}
                  ${this.isChatRoom() || this.isPrivateChat()
                    ? html`
                        <wy-dropdown>
                          <wy-dropdown-item @click=${() => (this.showDetails = true)}>
                            <wy-icon name="information"></wy-icon>
                            ${msg("Details")}
                          </wy-dropdown-item>
                          ${this.isChatRoom()
                            ? html`
                                <wy-dropdown-item @click=${() => (this.showAddMembers = true)}>
                                  <wy-icon name="account-plus"></wy-icon> ${msg("Add members")}
                                </wy-dropdown-item>
                                <wy-dropdown-item @click=${() => this.leaveConversation()}>
                                  <wy-icon name="account-minus"></wy-icon> ${msg("Leave conversation")}
                                </wy-dropdown-item>
                              `
                            : nothing}
                        </wy-dropdown>
                      `
                    : nothing}
                </nav>
              </header>
            `
          : nothing}
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
                              .size=${128}
                            ></wy-avatar-group>
                          `
                        : !this.isContextualChat() && (this.conversation.display_name || this.conversation.avatar_url)
                        ? html`
                            <wy-avatar
                              src=${ifDefined(otherMember?.avatar_url)}
                              name=${this.conversation.display_name}
                              size=${128}
                            ></wy-avatar>
                          `
                        : nothing}
                      ${!this.isContextualChat() && this.conversationTitle
                        ? html` <h3 class="wy-headline">${this.conversationTitle}</h3> `
                        : nothing}
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
                .pagerRef=${this.pagerRef}
                @scroll-to-bottom=${() => this.scrollToBottom()}
              ></wy-messages>
            `
          : html`
              <div class="wy-messages">
                <wy-empty class="wy-pane">
                  ${isPending || membersIsPending || !this.user
                    ? html`<wy-spinner overlay></wy-spinner>`
                    : msg("Start the conversation!")}
                </wy-empty>
              </div>
            `}

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
      </div>

      <!-- add members modal -->
      ${portal(
        this.showAddMembers,
        html`
          <wy-overlay @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}>
            <header class="wy-appbars">
              <nav class="wy-appbar">
                <wy-button kind="icon" @click=${() => (this.showAddMembers = false)}>
                  <wy-icon name="close"></wy-icon>
                </wy-button>
                <div class="wy-appbar-text">${msg("Add members")}</div>
              </nav>
            </header>

            <wy-users-search
              .buttonTitle=${msg("Add")}
              .existingMembers=${membersData}
              @submit=${(e: CustomEvent) => this.addMembers(e.detail.members)}
            ></wy-users-search>
          </wy-overlay>
        `,
        () => (this.showAddMembers = false)
      )}

      <!-- details modal -->
      ${portal(
        this.showDetails,
        html`
          <wy-overlay @release-focus=${() => this.dispatchEvent(this.releaseFocusEvent())}>
            <header class="wy-appbars">
              <nav class="wy-appbar">
                <wy-button kind="icon" @click=${() => (this.showDetails = false)}>
                  <wy-icon name="close"></wy-icon>
                </wy-button>
                <div class="wy-appbar-text">${msg("Details")}</div>
              </nav>
            </header>
            <div class="wy-scroll-y">
              ${this.conversation && this.user
                ? html`
                    <div class="wy-avatar-header">
                      ${(this.isContextualChat() || this.isChatRoom()) && !this.conversation.avatar_url
                        ? html`
                            <wy-avatar-group
                              .members=${membersData}
                              .user=${this.user}
                              .name=${this.conversation.display_name}
                              .size=${128}
                            ></wy-avatar-group>
                          `
                        : this.conversation.display_name || this.conversation.avatar_url
                        ? html`
                            <wy-avatar
                              src=${this.conversation.avatar_url}
                              name=${this.conversation.display_name}
                              size=${128}
                            ></wy-avatar>
                          `
                        : nothing}
                      ${!this.isContextualChat() && this.conversationTitle
                        ? html` <h3 class="wy-headline">${this.conversationTitle}</h3> `
                        : nothing}
                    </div>
                    ${this.isChatRoom()
                      ? html`
                          <div class="wy-pane-group">
                            <label class="wy-input-label">${msg("Conversation name")}</label>
                            <div class="wy-input-group">
                              <input
                                class="wy-input"
                                .value=${this.conversationTitleInput}
                                @input=${(e: Event) => {
                                  this.conversationTitleInput = (e.target as HTMLInputElement).value;
                                }}
                                @keyup=${inputConsumeWithBlurOnEscape}
                              />
                              <wy-button
                                kind="icon"
                                class="wy-input-group-button-icon"
                                buttonClass="wy-input-group-button-icon wy-button-primary"
                                @click=${() => this.handleSaveConversationName()}
                              >
                                <wy-icon name="check"></wy-icon>
                              </wy-button>
                            </div>
                            <div class="wy-description">
                              ${msg("Changing the name of a group chat changes it for everyone.")}
                            </div>
                          </div>
                          <div class="wy-pane-group">
                            <label class="wy-input-label">${msg("Members")}</label>
                            ${membersData
                              ? html`
                                  ${membersData.data?.map(
                                    (member: MemberType) => html`
                                      <div class="wy-item">
                                        <wy-avatar
                                          .src=${member.avatar_url}
                                          .name=${member.display_name}
                                          size=${32}
                                        ></wy-avatar>
                                        <div class="wy-item-body">
                                          ${member.display_name}
                                          ${this.conversation!.created_by_id === member.id
                                            ? html` <wy-icon
                                                size="20"
                                                inline
                                                name="shield-star"
                                                title=${msg("Admin")}
                                              ></wy-icon>`
                                            : nothing}
                                        </div>

                                        ${this.conversation!.created_by_id === this.user!.id ||
                                        member.id !== this.user!.id
                                          ? html`
                                              <wy-dropdown>
                                                ${this.conversation!.created_by_id === this.user!.id &&
                                                member.id !== this.user!.id
                                                  ? html` <wy-dropdown-item
                                                      @click=${() => this.leaveConversation(member.id)}
                                                    >
                                                      <wy-icon name="account-minus"></wy-icon>
                                                      ${msg("Remove member")}
                                                    </wy-dropdown-item>`
                                                  : member.id === this.user!.id
                                                  ? html`
                                                      <wy-dropdown-item @click=${() => this.leaveConversation()}>
                                                        <wy-icon name="account-minus"></wy-icon>
                                                        ${msg("Leave conversation")}
                                                      </wy-dropdown-item>
                                                    `
                                                  : nothing}
                                              </wy-dropdown>
                                            `
                                          : nothing}
                                      </div>
                                    `
                                  ) ?? nothing}
                                `
                              : nothing}
                          </div>
                          <div class="wy-pane-group">
                            <wy-button
                              kind="filled"
                              buttonClass="wy-button-primary"
                              @click=${() => {
                                this.showDetails = false;
                                this.showAddMembers = true;
                              }}
                              title=${msg("Add members")}
                            >
                              <wy-icon name="account-plus"></wy-icon>
                              ${msg("Add members")}
                            </wy-button>
                          </div>
                        `
                      : nothing}
                  `
                : nothing}
            </div>
          </wy-overlay>
        `,
        () => (this.showDetails = false)
      )}
    `;
  }

  override disconnectedCallback(): void {
    if (this.weavyContext && this.conversation) {
      this.unsubscribeToRealtime(this.conversation);
    }
    super.disconnectedCallback();
  }
}
