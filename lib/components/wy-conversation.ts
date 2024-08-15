import { LitElement, html, type PropertyValues, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { ConversationTypeGuid, type ConversationType } from "../types/conversations.types";
import type {
  MessageMutationContextType,
  MessageType,
  MessagesResultType,
  MutateMessageProps,
} from "../types/messages.types";
import { getMessagesOptions, getAddMessageMutationOptions } from "../data/messages";

import { InfiniteQueryController } from "../controllers/infinite-query-controller";

import { ReverseInfiniteScrollController } from "../controllers/infinite-scroll-controller";

import { MutationController } from "../controllers/mutation-controller";

import { hasScroll, isParentAtBottom, scrollParentToBottom } from "../utils/scroll-position";
import { addCacheItem, keepFirstPage, updateCacheItem, updateCacheItems } from "../utils/query-cache";

import { localized, msg } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";

import type { RealtimeMessageEventType, RealtimeReactionEventType } from "../types/realtime.types";
import { whenDocumentVisible } from "../utils/dom";
import { ReactableType } from "../types/reactions.types";
import { PollMutationType, getPollMutation } from "../data/poll";
import { hasPermission } from "../utils/permission";
import {
  MarkConversationMutationType,
  UpdateConversationMutationType,
  getMarkConversationMutation,
  getUpdateConversationMutation,
} from "../data/conversation";
import { WeavyContextProps } from "../types/weavy.types";
import { BlockConsumerMixin } from "../mixins/block-consumer-mixin";
import { appContext } from "../contexts/app-context";
import { provide } from "@lit/context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { PermissionTypes } from "../types/app.types";

import chatCss from "../scss/all";
import "./wy-empty";
import "./wy-messages";
import "./wy-message-editor";
import "./wy-message-typing";
import "./wy-spinner";

@customElement("wy-conversation")
@localized()
export default class WyConversation extends BlockConsumerMixin(LitElement) {
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

  protected exportParts = new ShadowPartsController(this);

  // Override app context
  @provide({ context: appContext })
  @property({ attribute: false })
  conversation?: ConversationType;

  @property({ type: Number })
  conversationId?: number;

  @property()
  cssClass?: string;

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

  isPrivateChat(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.PrivateChat;
  }

  isChatRoom(conversation?: ConversationType) {
    return (conversation ?? this.conversation)?.type === ConversationTypeGuid.ChatRoom;
  }

  protected markConversationMutation?: MarkConversationMutationType;

  messagesQuery = new InfiniteQueryController<MessagesResultType>(this);
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

  protected async handleTyping(e: CustomEvent) {
    if (e.detail.count) {
      if (this.isAtBottom) {
        requestAnimationFrame(() => {
          this.scrollToBottom(true);
        });
      }
    }
  }

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
      ["messages", realtimeEvent.message.app.id],
      realtimeEvent.message,
      tempId
    );
    updateCacheItem(
      this.weavyContext.queryClient,
      ["conversations"],
      this.conversationId,
      (conversation: ConversationType) => (conversation.last_message = realtimeEvent.message)
    );

    if (realtimeEvent.message.app.id === this.conversation.id) {
      if (!this.conversation.display_name && realtimeEvent.message.plain) {
        this.setEmptyConversationTitle(realtimeEvent.message.plain);
      }

      if (realtimeEvent.actor.id !== this.user.id) {
        // display toast
        if (!this.isAtBottom || document.hidden) {
          console.log("realtime showUnread", realtimeEvent.message.id);
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
        if (!item.reactions) {
          item.reactions = { count: 0 };
        }
        item.reactions.data = [
          ...(item.reactions.data || []).filter((r: ReactableType) => r.created_by?.id !== realtimeEvent.actor.id),
          { content: realtimeEvent.reaction, created_by: realtimeEvent.actor },
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
        if (item.reactions) {
          if (item.reactions.data) {
            item.reactions.data = item.reactions.data.filter((item) => item.created_by?.id !== realtimeEvent.actor.id);
          }
        }
      }
    );
  };

  get isAtBottom() {
    return this.pagerRef.value ? isParentAtBottom(this.pagerRef.value) : true;
  }

  scrollToBottom(smooth: boolean = false) {
    if (hasScroll(this.pagerRef.value) && this.conversationId) {
      if (this.weavyContext) {
        keepFirstPage(this.weavyContext.queryClient, ["messages", this.conversationId]);
      }
      scrollParentToBottom(this.pagerRef.value, smooth);
    }
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
      await whenDocumentVisible();
      if (!this.isConnected) {
        return;
      }
      if (document.hidden) {
        // Try again when visible
        await this.markAsRead(messageId);
        return;
      }
    }

    if (this.conversation && this.conversation.last_message) {
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

  #unsubscribeToRealtime?: () => void;

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    super.willUpdate(changedProperties);

    // if context updated
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      //console.log("conversation context changed")
      this.updateConversationMutation = getUpdateConversationMutation(this.weavyContext);
      this.markConversationMutation = getMarkConversationMutation(this.weavyContext);
    }

    // conversationId is changed
    if ((changedProperties.has("weavyContext") || changedProperties.has("conversationId")) && this.weavyContext) {
      //console.log("context/conversationId changed", this.conversationId);

      this.#unsubscribeToRealtime?.();

      if (this.conversationId) {
        this.messagesQuery.trackInfiniteQuery(getMessagesOptions(this.weavyContext, this.conversationId));
        this.addMessageMutation.trackMutation(
          getAddMessageMutationOptions(this.weavyContext, ["messages", this.conversationId])
        );
        this.pollMutation = getPollMutation(this.weavyContext, ["messages", this.conversationId]);

        // set initial value of unread messages banner
        this.lastReadMessageId = undefined;
        this.lastReadMessageShow = false;

        const subscribeGroup = `a${this.conversationId}`;

        this.weavyContext.subscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
        this.weavyContext.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        this.weavyContext.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);

        this.#unsubscribeToRealtime = () => {
          this.weavyContext?.unsubscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
          this.weavyContext?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
          this.weavyContext?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
          this.#unsubscribeToRealtime = undefined;
        };
      } else {
        //console.log("no more conversation")
        this.messagesQuery.untrackInfiniteQuery();
        this.addMessageMutation.untrackMutation();
      }
    }

    // Keep at bottom when new messages banner appear
    if (changedProperties.has("lastReadMessageShow") && this.lastReadMessageShow) {
      this.shouldBeAtBottom = this.isAtBottom;
    }

    // Always try to scroll to bottom when conversationId changed
    if (changedProperties.has("conversationId") && changedProperties.get("conversationId") !== this.conversationId) {
      this.shouldBeAtBottom = Boolean(this.conversationId);
    } else {
      //console.log("conversationId not changed, keeping bottom scroll", changedProperties.keys())
      // Check state for scrollParentToBottom
      this.shouldBeAtBottom = this.isAtBottom;
    }

    // if conversation is updated
    if (changedProperties.has("conversation") && this.conversation) {
      //console.log("conversation updated", this.conversation.id);
      // conversation id is changed, mark as read

      // Check unread status
      if (this.conversation && this.conversation.is_unread && this.conversation.last_message) {
        const unreadId = this.conversation.members.data?.find((member) => member.id === this.user?.id)?.marked_id;
        // prevent new message toast if all messages are read
        if (unreadId && unreadId < this.conversation.last_message.id) {
          // display toast
          //console.log("conversation updated, show unread, mark as read", unreadId);
          this.showUnread(
            "below",
            this.conversation.members.data?.find((member) => member.id === this.user?.id)?.marked_id
          );
        }
        this.markAsRead();
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
      ${this.conversation && infiniteData
        ? html`
            ${!hasNextPage && !isPending ? html` <!-- Top of the conversation --> ` : nothing}
            <wy-messages
              .conversation=${this.conversation}
              .infiniteMessages=${infiniteData}
              .unreadMarkerId=${this.lastReadMessageId}
              .unreadMarkerPosition=${this.lastReadMessagePosition}
              .unreadMarkerShow=${this.lastReadMessageShow}
              @vote=${(e: CustomEvent) => {
                this.pollMutation?.mutate({
                  optionId: e.detail.id,
                  parentType: e.detail.parentType,
                  parentId: e.detail.parentId,
                });
              }}
            >
              <div slot="start" ${ref(this.pagerRef)} part="wy-pager"></div>
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
                ${isPending || !this.conversation
                  ? html`<wy-spinner overlay></wy-spinner>`
                  : msg("Start the conversation!")}
              </wy-empty>
            </div>
          `}
      ${this.conversation && hasPermission(PermissionTypes.Create, this.conversation?.permissions)
        ? html`
            <div class="wy-footerbar wy-footerbar-sticky">
              <wy-message-editor
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
    this.#unsubscribeToRealtime?.();
    document.removeEventListener("visibilitychange", this.markAsReadWhenVisible);
    super.disconnectedCallback();
  }
}
