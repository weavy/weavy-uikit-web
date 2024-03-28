import { LitElement, html, type PropertyValues, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ContextConsumer } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../client/context-definition";
import { AccessType } from "../types/app.types";
import { type ConversationType } from "../types/conversations.types";
import type {
  MessageMutationContextType,
  MessageType,
  MessagesResultType,
  MutateMessageProps,
} from "../types/messages.types";
import type { UserType } from "../types/users.types";
import { type FeaturesConfigType, type FeaturesListType } from "../types/features.types";

import { getApiOptions } from "../data/api";
import { getMessagesOptions, getAddMessageMutationOptions } from "../data/messages";

import { InfiniteQueryController } from "../controllers/infinite-query-controller";

import { ReverseInfiniteScrollController } from "../controllers/infinite-scroll-controller";

import { MutationController } from "../controllers/mutation-controller";
import { QueryController } from "../controllers/query-controller";

import { hasScroll, isParentAtBottom, scrollParentToBottom } from "../utils/scroll-position";
import { addCacheItem, keepFirstPage, updateCacheItem, updateCacheItems } from "../utils/query-cache";

import chatCss from "../scss/all";

import "./wy-empty";
import "./wy-messages";
import "./wy-message-editor";
import "./wy-spinner";

import { localized, msg } from "@lit/localize";
import { Ref, createRef } from "lit/directives/ref.js";

import type { RealtimeMessageEventType, RealtimeReactionEventType } from "../types/realtime.types";
import { whenParentsDefined, whenVisible } from "../utils/dom";
import { WeavyContextProps } from "../types/weavy.types";
import { ReactableType } from "../types/reactions.types";
import { PollMutationType, getPollMutation } from "../data/poll";
import { hasAccess } from "../utils/access";
import {
  MarkConversationMutationType,
  UpdateConversationMutationType,
  getMarkConversationMutation,
  getUpdateConversationMutation,
} from "../data/conversation";

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

      wy-message {
        scroll-margin-block: 6rem;
      }
    `,
  ];

  protected weavyContextConsumer?: ContextConsumer<{ __context__: WeavyContextType }, this>;

  // Manually consumed in scheduleUpdate()
  @state()
  protected weavyContext?: WeavyContextType;

  @property({ attribute: false })
  user?: UserType;

  @property({ type: Number })
  conversationId?: number;

  @property({ attribute: false })
  conversation?: ConversationType;

  @property()
  cssClass?: string;

  @state()
  availableFeatures?: FeaturesListType;

  @property({ type: Object })
  features: FeaturesConfigType = {};

  @state()
  lastReadMessagePosition: "above" | "below" = "below";

  @state()
  lastReadMessageId?: number;

  @state()
  lastReadMessageShow: boolean = false;

  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  protected markConversationMutation?: MarkConversationMutationType;

  messagesQuery = new InfiniteQueryController<MessagesResultType>(this);
  userQuery = new QueryController<UserType>(this);
  featuresQuery = new QueryController<FeaturesListType>(this);
  private updateConversationMutation?: UpdateConversationMutationType;

  protected pollMutation?: PollMutationType;

  protected addMessageMutation = new MutationController<
    MessageType,
    Error,
    MutateMessageProps,
    MessageMutationContextType
  >(this);

  protected infiniteScroll = new ReverseInfiniteScrollController(this);

  protected pagerRef: Ref<Element> = createRef();

  protected shouldBeAtBottom = true;

  protected async handleSubmit(e: CustomEvent) {
    if (!this.conversation || !this.user) {
      throw new Error("Error submitting message. Missing user or conversation.");
    }

    const messageData: MessageType = await this.addMessageMutation.mutate({
      app_id: this.conversation.id,
      text: e.detail.text,
      meeting_id: e.detail.meetingId,
      poll_options: e.detail.pollOptions,
      embed_id: e.detail.embed,
      blobs: e.detail.blobs,
      user_id: this.user.id,
      temp_id: Math.random(),
    });

    this.hideUnread();
    this.markAsRead(messageData.id);

    requestAnimationFrame(() => {
      this.scrollToBottom();
    });

    return messageData;
  }

  async setEmptyConversationTitle(name: string) {
    if (!this.conversation || this.conversation.display_name) {
      return;
    }

    await this.updateConversationMutation?.mutate({ id: this.conversation.id, name: name });
  }

  private handleRealtimeMessage = (realtimeEvent: RealtimeMessageEventType) => {
    if (!this.weavyContext || !this.conversation || !this.conversationId || !this.user) {
      return;
    }

    realtimeEvent.message.created_by = realtimeEvent.actor;
    const tempId = realtimeEvent.message.metadata?.temp_id
      ? parseFloat(realtimeEvent.message.metadata?.temp_id)
      : undefined;
    addCacheItem(
      this.weavyContext.queryClient,
      ["messages", realtimeEvent.message.app_id],
      realtimeEvent.message,
      tempId
    );
    updateCacheItem(this.weavyContext.queryClient,
      ["conversations"],
      this.conversationId,
      (conversation: ConversationType) => conversation.last_message = realtimeEvent.message
      )

    if (realtimeEvent.message.app_id === this.conversation.id) {
      if (!this.conversation.display_name && realtimeEvent.message.plain) {
        this.setEmptyConversationTitle(realtimeEvent.message.plain);
      }

      // display toast
      if (!this.isAtBottom || document.hidden) {
        //console.log("realtime showUnread", realtimeEvent.message.id);
        this.showUnread("above", realtimeEvent.message.id);
      }

      if (this.isAtBottom) {
        // mark as read
        // TBD: instant?
        this.markAsRead(realtimeEvent.message.id);

        requestAnimationFrame(() => {
          this.scrollToBottom();
        });
      }
    }
  };

  private handleRealtimeReactionAdded = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || !this.user || !this.conversation) {
      return;
    }

    updateCacheItems(
      this.weavyContext.queryClient,
      { queryKey: ["messages"], exact: false },
      realtimeEvent.entity.id,
      (item: MessageType) => {
        item.reactions = [
          ...(item.reactions || []).filter((r: ReactableType) => r.created_by_id !== realtimeEvent.actor.id),
          { content: realtimeEvent.reaction, created_by_id: realtimeEvent.actor.id },
        ];
      }
    );
  };

  private handleRealtimeReactionDeleted = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavyContext || !this.conversation || !this.user) {
      return;
    }
    updateCacheItems(
      this.weavyContext.queryClient,
      { queryKey: ["messages"], exact: false },
      realtimeEvent.entity.id,
      (item: MessageType) => {
        item.reactions = item.reactions.filter((item) => item.created_by_id !== realtimeEvent.actor.id);
      }
    );
  };

  get isAtBottom() {
    return this.pagerRef.value ? isParentAtBottom(this.pagerRef.value) : true;
  }

  scrollToBottom() {
    if (hasScroll(this.pagerRef.value)) {
      if (this.weavyContext && this.conversation) {
        keepFirstPage(this.weavyContext.queryClient, ["messages", this.conversation.id]);
      }
      scrollParentToBottom(this.pagerRef.value);
    }
  }

  protected unsubscribeToRealtime(conversationId: number) {
    if (!this.weavyContext) {
      return;
    }

    //console.log("unsubscribing conversation realtime", conversation.id);

    this.weavyContext.unsubscribe(`a${conversationId}`, "message_created", this.handleRealtimeMessage);
    this.weavyContext.unsubscribe(`a${conversationId}`, "reaction_added", this.handleRealtimeReactionAdded);
    this.weavyContext.unsubscribe(`a${conversationId}`, "reaction_removed", this.handleRealtimeReactionDeleted);
  }

  showUnread(placement: "above" | "below", messageId?: number) {
    if (messageId && !this.lastReadMessageShow) {
      this.lastReadMessagePosition = placement;
      this.lastReadMessageId = messageId;
      this.lastReadMessageShow = true;
    }
  }

  hideUnread() {
    this.lastReadMessageShow = false;
  }

  async markAsRead(messageId?: number, instantly: boolean = false) {
    if (!instantly) {
      // TODO: Check visibility of the component
      await whenVisible();
      if (!this.isConnected) {
        return;
      }
      if (document.hidden) {
        // Try again when visible
        await this.markAsRead(messageId);
        return;
      }
    }

    if (this.conversation) {
      this.markConversationMutation?.mutate({
        id: this.conversation.id,
        markAsRead: true,
        messageId: messageId ?? this.conversation.last_message?.id,
      });
    }
  }

  protected markAsReadWhenVisible = () => {
    if (!document.hidden) {
      this.markAsRead();
    }
  };

  override async scheduleUpdate() {
    await whenParentsDefined(this);
    this.weavyContextConsumer = new ContextConsumer(this, { context: weavyContextDefinition, subscribe: true });

    if (this.weavyContextConsumer?.value && this.weavyContext !== this.weavyContextConsumer?.value) {
      this.weavyContext = this.weavyContextConsumer?.value;
    }

    await super.scheduleUpdate();
  }

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    // if context updated
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      //console.log("conversation context changed")
      this.userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));
      this.featuresQuery.trackQuery(getApiOptions<FeaturesListType>(this.weavyContext, ["features", "chat"]));
      this.updateConversationMutation = getUpdateConversationMutation(this.weavyContext);
      this.markConversationMutation = getMarkConversationMutation(this.weavyContext);
    }

    // ConversationId doesn't exist anymore
    if (changedProperties.has("conversationId")) {
      //console.log("conversation id changed")
      const lastConversationId = changedProperties.get("conversationId");

      // conversation id is changed
      if (lastConversationId && lastConversationId !== this.conversationId) {
        //console.log("conversation has changed id", lastConversation.id, this.conversation?.id)
        this.unsubscribeToRealtime(lastConversationId);
      }
    }

    // conversationId is changed
    if ((changedProperties.has("weavyContext") || changedProperties.has("conversationId")) && this.weavyContext) {
      //console.log("context/conversationId changed", this.conversationId);
      if (this.conversationId) {
        this.messagesQuery.trackInfiniteQuery(getMessagesOptions(this.weavyContext, this.conversationId));
        this.addMessageMutation.trackMutation(
          getAddMessageMutationOptions(this.weavyContext, ["messages", this.conversationId])
        );
        this.pollMutation = getPollMutation(this.weavyContext, ["messages", this.conversationId]);

        // set initial value of unread messages banner
        this.lastReadMessageId = undefined;
        this.lastReadMessageShow = false;

        this.weavyContext.subscribe(`a${this.conversationId}`, "message_created", this.handleRealtimeMessage);
        this.weavyContext.subscribe(`a${this.conversationId}`, "reaction_added", this.handleRealtimeReactionAdded);
        this.weavyContext.subscribe(`a${this.conversationId}`, "reaction_removed", this.handleRealtimeReactionDeleted);
      } else {
        //console.log("no more conversation")
        this.messagesQuery.untrackInfiniteQuery();
        this.addMessageMutation.untrackMutation();
      }
    }

    // Always scroll to bottom when conversationId changed
    if (changedProperties.has("conversationId") && changedProperties.get("conversationId") !== this.conversationId) {
      this.shouldBeAtBottom = true;
    } else {
      //console.log("conversationId not changed, keeping bottom scroll")
      // Check state for scrollParentToBottom
      this.shouldBeAtBottom = this.isAtBottom;
    }

    if (!this.userQuery.result?.isPending) {
      this.user = this.userQuery.result?.data;
    }

    if (!this.availableFeatures && !this.featuresQuery.result?.isPending) {
      this.availableFeatures = this.featuresQuery.result?.data;
    }

    // if conversation is updated
    if (changedProperties.has("conversation") && this.conversation) {
      //console.log("conversation updated", this.conversation.id);
      // conversation id is changed, mark as read

      // Check unread status
      if (this.conversation && this.conversation.is_unread && this.conversation.last_message) {
        const unreadId = this.conversation.members.data.find((member) => member.id === this.user?.id)?.marked_id;
        if (unreadId) {
          // display toast
          //console.log("conversation updated, show unread, mark as read", unreadId);
          this.showUnread(
            "below",
            this.conversation.members.data.find((member) => member.id === this.user?.id)?.marked_id
          );
          this.markAsRead();
        }
      } else {
        //console.log("conversation updated hideUnread?")
        //this.hideUnread();
      }
    }
  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.messagesQuery.result, this.pagerRef.value);
  }

  override render() {
    const { isPending: networkIsPending } = this.weavyContext?.network ?? { isPending: true };
    const { data: infiniteData, isPending, hasNextPage } = this.messagesQuery.result ?? { isPending: networkIsPending };

    return html`
      ${this.conversation && this.user && infiniteData
        ? html`
            ${!hasNextPage && !isPending ? html` <!-- Top of the conversation --> ` : nothing}
            <wy-messages
              .app=${this.conversation}
              .user=${this.user}
              .infiniteMessages=${infiniteData}
              .availableFeatures=${this.availableFeatures}
              .features=${this.features}
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
                ${isPending || !this.user || !this.conversation
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

  override updated() {
    if (this.shouldBeAtBottom) {
      requestAnimationFrame(() => {
        this.scrollToBottom();
      });
    }
  }

  override connectedCallback(): void {
    super.connectedCallback();
    //console.log("conversation connected", this.conversationId)
    document.addEventListener("visibilitychange", this.markAsReadWhenVisible);
  }

  override disconnectedCallback(): void {
    //console.log("conversation disconnected", this.conversationId)
    document.removeEventListener("visibilitychange", this.markAsReadWhenVisible);
    super.disconnectedCallback();
  }
}
