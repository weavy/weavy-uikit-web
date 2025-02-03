import { LitElement, html, type PropertyValues, nothing, css } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { AppTypeGuid, type AppType, PermissionType } from "../types/app.types";
import type { MessageType, MessagesResultType, MutateMessageProps } from "../types/messages.types";
import { getMessagesOptions, getAddMessageMutationOptions } from "../data/messages";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { ReverseInfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { MutationController } from "../controllers/mutation-controller";
import { hasScroll, isParentAtBottom, scrollParentToBottom } from "../utils/scroll-position";
import {
  addCacheItem,
  getCacheItem,
  getPendingCacheItem,
  keepPages,
  updateCacheItem,
  updateCacheItems,
} from "../utils/query-cache";
import { localized, msg } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import type { RealtimeMessageEventType, RealtimeReactionEventType } from "../types/realtime.types";
import { whenConnected, whenDocumentVisible, whenElementVisible } from "../utils/dom";
import { ReactableType } from "../types/reactions.types";
import { PollMutationType, getPollMutation } from "../data/poll";
import { hasPermission } from "../utils/permission";
import {
  MarkConversationMutationType,
  UpdateConversationMutationType,
  getMarkConversationMutation,
  getUpdateConversationMutation,
} from "../data/conversation";
import { WeavyProps } from "../types/weavy.types";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { AppContext } from "../contexts/app-context";
import { provide } from "@lit/context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { QueryController } from "../controllers/query-controller";
import { MembersResultType, MemberType } from "../types/members.types";
import { getMemberOptions } from "../data/members";

import chatCss from "../scss/all.scss";
import pagerStyles from "../scss/components/pager.scss";

import "./wy-empty";
import "./wy-messages";
import "./wy-editor-message";
import "./wy-message-typing";
import "./wy-spinner";

@customElement("wy-conversation")
@localized()
export default class WyConversation extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = [
    chatCss,
    pagerStyles,
    css`
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
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
  @provide({ context: AppContext })
  @property({ attribute: false })
  conversation?: AppType;

  @property({ type: Number })
  conversationId?: number;

  @property()
  cssClass?: string;

  @state()
  lastReadMessagePosition: "above" | "below" = "below";

  @state()
  lastReadMessageId?: number;

  @state()
  showNewMessages: boolean = false;

  /**
   * A keyboard-consuming element releases focus.
   * @event release-focus
   */
  releaseFocusEvent = () => new CustomEvent<undefined>("release-focus", { bubbles: true, composed: true });

  // intersection observer to check if we have scrolled to bottom
  protected bottomObserver: IntersectionObserver | undefined;

  isPrivateChat(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.PrivateChat;
  }

  isChatRoom(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.ChatRoom;
  }

  protected markConversationMutation?: MarkConversationMutationType;

  messagesQuery = new InfiniteQueryController<MessagesResultType>(this);
  membersQuery = new QueryController<MembersResultType>(this);

  private updateConversationMutation?: UpdateConversationMutationType;

  protected pollMutation?: PollMutationType;

  protected addMessageMutation = new MutationController<MessageType, Error, MutateMessageProps, unknown>(this);

  protected infiniteScroll = new ReverseInfiniteScrollController(this);

  protected pagerRef: Ref<HTMLElement> = createRef();

  protected bottomRef: Ref<HTMLElement> = createRef();

  protected shouldBeAtBottom = true;

  protected isTyping = false;

  protected async handleTyping(e: CustomEvent) {
    this.isTyping = Boolean(e.detail.count);

    if (this.isTyping && this.isAtBottom) {
      requestAnimationFrame(() => {
        this.scrollToBottom(true);
      });
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
      user: this.user,
    });

    this.showNewMessages = false;

    requestAnimationFrame(() => {
      this.scrollToBottom();
    });

    return messageData;
  }

  async setEmptyConversationTitle(name: string) {
    if (!this.conversation || this.conversation.display_name) {
      return;
    }

    await this.updateConversationMutation?.mutate({ appId: this.conversation.id, name: name });
  }

  private handleRealtimeMessage = (realtimeEvent: RealtimeMessageEventType) => {
    if (!this.weavy || !this.conversation || !this.conversationId || !this.user) {
      return;
    }

    // set message in messages cache
    const queryKey = ["messages", realtimeEvent.message.app.id];
    let existing = getCacheItem<MessageType>(this.weavy.queryClient, queryKey, realtimeEvent.message.id);
    if (!existing) {
      if (realtimeEvent.message.created_by.id === this.user.id) {
        // replace (oldest) pending message with the
        existing = getPendingCacheItem<MessageType>(this.weavy.queryClient, queryKey, true);
        if (existing) {
          updateCacheItem(this.weavy.queryClient, queryKey, existing.id, (item: MessageType) => {
            // REVIEW: Ändra updateCacheItem så vi kan sätta ett "helt" objekt?
            // return realtimeEvent.message;
            item.id = realtimeEvent.message.id;
            item.app = realtimeEvent.message.app;
            item.text = realtimeEvent.message.text;
            item.html = realtimeEvent.message.html;
            item.embed = realtimeEvent.message.embed;
            item.meeting = realtimeEvent.message.meeting;
            item.attachments = realtimeEvent.message.attachments;
            item.options = realtimeEvent.message.options;
            item.created_at = realtimeEvent.message.created_at;
            item.created_by = realtimeEvent.message.created_by;
            item.updated_at = realtimeEvent.message.updated_at;
            item.updated_by = realtimeEvent.message.updated_by;
          });
        }
      }
      if (!existing) {
        // add to cache
        addCacheItem(this.weavy.queryClient, queryKey, realtimeEvent.message);
      }
    }

    // set last_message in cache
    this.weavy.queryClient.setQueryData(["apps", realtimeEvent.message.app.id], (app: AppType) =>
      app ? { ...app, last_message: realtimeEvent.message } : app
    );

    // special handing of bot chat?
    if (!this.conversation.display_name && realtimeEvent.message.plain) {
      this.setEmptyConversationTitle(realtimeEvent.message.plain);
    }

    // 3. mark as read/unread (including updating both details and list cache)
    if (realtimeEvent.actor.id !== this.user.id) {
      if (this.isAtBottom) {
        // mark as read
        this.markAsRead(realtimeEvent.message.id);
        requestAnimationFrame(() => {
          this.scrollToBottom();
        });
      } else {
        // set is_unread in cache
        this.weavy.queryClient.setQueryData(["apps", realtimeEvent.message.app.id], (app: AppType) =>
          app ? { ...app, is_unread: true } : app
        );

        this.lastReadMessagePosition = "above";
        this.lastReadMessageId = realtimeEvent.message.id;
        this.showNewMessages = true;
      }

      // update members cache to indicate that creator has seen the message
      updateCacheItem(
        this.weavy.queryClient,
        ["members", realtimeEvent.message.app.id],
        realtimeEvent.actor.id,
        (item: MemberType) => {
          item.marked_id = realtimeEvent.message.id;
          item.marked_at = realtimeEvent.message.created_at;
        }
      );
    }
  };

  private handleRealtimeReactionAdded = (realtimeEvent: RealtimeReactionEventType) => {
    if (!this.weavy || !this.user || !this.conversation) {
      return;
    }

    updateCacheItems(
      this.weavy.queryClient,
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
    if (!this.weavy || !this.conversation || !this.user) {
      return;
    }
    updateCacheItems(
      this.weavy.queryClient,
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
    return this.bottomRef.value ? isParentAtBottom(this.bottomRef.value) : true;
  }

  async scrollToBottom(smooth: boolean = false) {
    if (this.bottomRef.value) {
      await whenElementVisible(this.bottomRef.value);
    }
    if (hasScroll(this.bottomRef.value) && this.conversationId) {
      requestAnimationFrame(() => {
        keepPages(this.weavy?.queryClient, ["messages", this.conversationId], undefined, 1);
      });
      scrollParentToBottom(this.bottomRef.value, smooth);
    }
  }

  async markAsRead(messageId?: number) {
    await whenDocumentVisible();

    await Promise.race([whenElementVisible(this), whenConnected(this, false)]);

    if (!this.isConnected) {
      return;
    }

    if (this.conversation && this.conversation.last_message) {
      this.markConversationMutation?.mutate({
        appId: this.conversation.id,
        messageId: messageId ?? this.conversation.last_message.id,
        userId: this.user?.id,
      });
    }
  }

  protected markAsReadHandler = () => {
    if (!document.hidden && this.isAtBottom) {
      this.markAsRead();
    }
  };

  #unsubscribeToRealtime?: () => void;

  protected override willUpdate(changedProperties: PropertyValues<this & WeavyProps>) {
    super.willUpdate(changedProperties);

    // if context updated
    if (changedProperties.has("weavy") && this.weavy) {
      this.updateConversationMutation = getUpdateConversationMutation(this.weavy);
      this.markConversationMutation = getMarkConversationMutation(this.weavy);
    }

    // conversationId is changed
    if ((changedProperties.has("weavy") || changedProperties.has("conversationId")) && this.weavy) {
      this.#unsubscribeToRealtime?.();

      // Optimize pages cache for the conversation we're leaving
      const lastConversationId = changedProperties.get("conversationId");
      if (lastConversationId) {
        requestAnimationFrame(() => {
          keepPages(this.weavy?.queryClient, ["messages", lastConversationId], undefined, 1);
        });
      }

      if (this.conversationId) {
        this.membersQuery.trackQuery(getMemberOptions(this.weavy, this.conversationId, {}));

        this.messagesQuery.trackInfiniteQuery(getMessagesOptions(this.weavy, this.conversationId));
        this.addMessageMutation.trackMutation(
          getAddMessageMutationOptions(this.weavy, ["messages", this.conversationId])
        );

        this.pollMutation = getPollMutation(this.weavy, ["messages", this.conversationId]);

        // set initial value of unread messages banner
        this.lastReadMessageId = undefined;
        this.showNewMessages = false;

        const subscribeGroup = `a${this.conversationId}`;

        this.weavy.subscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
        this.weavy.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
        this.weavy.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);

        this.#unsubscribeToRealtime = () => {
          this.weavy?.unsubscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
          this.weavy?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
          this.weavy?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
          this.#unsubscribeToRealtime = undefined;
        };
      } else {
        this.messagesQuery.untrackInfiniteQuery();
        this.addMessageMutation.untrackMutation();
        this.membersQuery.untrackQuery();
      }
    }

    // Keep at bottom when new messages banner appear
    if (changedProperties.has("showNewMessages") && this.showNewMessages) {
      this.shouldBeAtBottom = this.isAtBottom;
    }

    if (changedProperties.has("conversationId") && changedProperties.get("conversationId") !== this.conversationId) {
      // always try to scroll to bottom when conversationId changed
      this.shouldBeAtBottom = Boolean(this.conversationId);
    } else {
      this.shouldBeAtBottom = this.isAtBottom;
    }

    // handle "new messages" and mark as read
    if (changedProperties.has("conversation")) {
      const oldConversation = changedProperties.get("conversation");

      if (
        oldConversation?.id !== this.conversation?.id ||
        oldConversation?.is_unread !== this.conversation?.is_unread
      ) {
        if (this.conversation?.is_unread) {
          // show new messages (before we mark as read)?
          const markedId = this.membersQuery.result.data?.data?.find(
            (member) => member.id === this.user?.id
          )?.marked_id;

          if (markedId && markedId < this.conversation.last_message.id) {
            this.lastReadMessagePosition = "below";
            this.lastReadMessageId = markedId;
            this.showNewMessages = true;
          }

          // mark as read?
          if (
            oldConversation?.id !== this.conversation?.id ||
            (oldConversation?.last_message.id !== this.conversation?.last_message.id) &&
            (this.shouldBeAtBottom || this.isAtBottom)
          ) {
            this.markAsRead();
          }
        } else if (oldConversation?.id !== this.conversation?.id) {
          // hide new messages
          this.showNewMessages = false;
        }
      }
    }
  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.messagesQuery.result, this.pagerRef.value);
  }

  override render() {
    const { isPending: networkIsPending } = this.weavy?.network ?? { isPending: true };
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
                ${isPending || !this.conversation
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

  override updated() {
    if (this.shouldBeAtBottom) {
      requestAnimationFrame(() => {
        this.scrollToBottom();
      });
    }

    if (!this.bottomObserver) {
      this.bottomObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!this.isTyping && this.conversation?.is_unread) {
              this.markAsRead();
            }
          }
        });
      });
    }
    if (this.bottomRef && this.bottomRef.value) {
      this.bottomObserver.observe(this.bottomRef.value);
    }
  }

  // hook up observer

  override connectedCallback(): void {
    super.connectedCallback();
    document.addEventListener("visibilitychange", this.markAsReadHandler);

    if (this.conversationId) {
      this.requestUpdate("conversationId");
    }
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();

    if (this.bottomObserver) {
      this.bottomObserver.disconnect();
    }

    document.removeEventListener("visibilitychange", this.markAsReadHandler);

    this.conversation = undefined;
    this.shouldBeAtBottom = this.isAtBottom;

    super.disconnectedCallback();
  }
}
