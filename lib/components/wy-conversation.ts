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
  getFlatInfiniteResultData,
  getPendingCacheItem,
  isInfiniteResultDataEmpty,
  keepPages,
  updateCacheItem,
  updateCacheItems,
} from "../utils/query-cache";
import { localized, msg } from "@lit/localize";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import type {
  RealtimeAppMarkedEventType,
  RealtimeMessageEventType,
  RealtimeReactionEventType,
} from "../types/realtime.types";
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
import { Feature } from "../types/features.types";
import { ifDefined } from "lit/directives/if-defined.js";
import { MetadataType } from "../types/lists.types";
import { ContextDataType, DataRefType } from "../types/refs.types";
import { getContextDataRef } from "../utils/contextdata";
import { getTitleFromText, truncateText } from "../utils/strings";

import chatCss from "../scss/all.scss";
import footerbarCss from "../scss/components/footerbar.scss";
import pagerCss from "../scss/components/pager.scss";

import "./base/wy-avatar";
import "./wy-empty";
import "./wy-messages";
import { WyMessageEditor } from "./wy-editor-message";
import "./wy-message-typing";
import "./base/wy-spinner";

@customElement("wy-conversation")
@localized()
export class WyConversation extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = [
    chatCss,
    pagerCss,
    footerbarCss,
    css`
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
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

  @property({ type: Boolean })
  header: boolean = false;

  @property()
  contextInstructions?: string;

  @property({ type: Array })
  contextData?: ContextDataType[];

  @state()
  contextDataRefs: Map<ContextDataType, DataRefType> = new Map();

  @state()
  lastReadMessagePosition: "above" | "below" = "below";

  @state()
  lastReadMessageId?: number;

  @state()
  showNewMessages: boolean = false;

  @state()
  isCreatingConversation: boolean = false;

  createConversation?: (payload: Omit<MutateMessageProps, "app_id">) => Promise<AppType>;
  requestMetadata?: (payload: MutateMessageProps) => Promise<MetadataType | undefined>;

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

  protected messagesQuery = new InfiniteQueryController<MessagesResultType>(this);
  protected membersQuery = new QueryController<MembersResultType>(this);
  protected botsQuery = new QueryController<MembersResultType>(this);

  protected markConversationMutation?: MarkConversationMutationType;
  protected updateConversationMutation?: UpdateConversationMutationType;
  protected pollMutation?: PollMutationType;
  protected addMessageMutation = new MutationController<MessageType, Error, MutateMessageProps, unknown>(this);

  protected infiniteScroll = new ReverseInfiniteScrollController(this);

  protected pagerRef: Ref<HTMLElement> = createRef();
  protected bottomRef: Ref<HTMLElement> = createRef();
  protected editorRef: Ref<WyMessageEditor> = createRef();

  protected shouldBeAtBottom = true;
  protected isTyping = false;

  get isAtBottom() {
    return this.bottomRef.value ? isParentAtBottom(this.bottomRef.value) : true;
  }

  async scrollToBottom(smooth: boolean = false) {
    if (this.bottomRef.value) {
      await whenElementVisible(this.bottomRef.value);
    }
    if (hasScroll(this.bottomRef.value) && this.conversationId && this.conversationId > 0) {
      requestAnimationFrame(() => {
        keepPages(this.weavy?.queryClient, ["messages", this.conversationId], undefined, 1);
      });
      scrollParentToBottom(this.bottomRef.value, smooth);
    }
  }

  protected async handleTyping(e: CustomEvent) {
    this.isTyping = Boolean(e.detail.count);

    if (this.isTyping && this.isAtBottom) {
      requestAnimationFrame(() => {
        this.scrollToBottom(true);
      });
    }
  }

  protected async handleSubmit(e: CustomEvent) {
    // TODO: refactor outside of conv?

    if (!this.user) {
      throw new Error("Error submitting message. Missing user.");
    }

    const initialPayload: Omit<MutateMessageProps, "app_id"> = {
      text: e.detail.text,
      meeting_id: e.detail.meetingId,
      poll_options: e.detail.pollOptions,
      embed_id: e.detail.embed,
      blobs: e.detail.blobs,
      user: this.user,
      context_id: e.detail.contextData?.[0],
    };

    if (this.contextInstructions) {
      initialPayload.metadata = {
        instructions: this.contextInstructions
      }
    }

    if (!this.conversation && this.weavy && this.createConversation) {
      this.isCreatingConversation = true;
      // Create new bot conversation
      await this.createConversation(initialPayload);
      await this.updateComplete;
    }

    if (!this.conversation) {
      throw new Error("Error submitting message. Missing conversation.");
    }

    const messageData: MessageType = await this.addMessageMutation.mutate({
      ...initialPayload,
      app_id: this.conversation.id,
    });

    this.showNewMessages = false;

    requestAnimationFrame(() => {
      this.scrollToBottom();
    });

    this.isCreatingConversation = false;

    return messageData;
  }

  setEditorText(text: string) {
    if (this.editorRef.value) {
      this.editorRef.value.text = text;
    }
  }

  async setEditorMetadata(metadata: MetadataType = {}) {
    await this.updateComplete;
    if (this.editorRef.value) {
      this.editorRef.value.metadata = metadata;
    }
  }

  async selectAllInEditor() {
    if (this.editorRef.value) {
      await this.updateComplete;
      await this.editorRef.value.updateComplete;
      this.editorRef.value?.selectAllContent();
    }
  }

  async setCursorLastInEditor() {
    if (this.editorRef.value) {
      await this.updateComplete;
      await this.editorRef.value.updateComplete;
      this.editorRef.value?.setCursorLast();
    }
  }

  focusEditor() {
    if (this.editorRef.value) {
      this.editorRef.value?.focusInput();
    }
  }

  async setEmptyConversationTitle(name: string) {
    if (!this.conversation || this.conversation.name) {
      return;
    }

    name = truncateText(name);

    await this.updateConversationMutation?.mutate({ appId: this.conversation.id, name: name });
  }

  private handleRealtimeMessage = async (realtimeEvent: RealtimeMessageEventType) => {
    if (!this.weavy || !this.conversation || !(this.conversationId && this.conversationId > 0) || !this.user) {
      return;
    }

    await this.messagesQuery.observer?.getCurrentQuery().promise;

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

  protected override async willUpdate(changedProperties: PropertyValues<this & WeavyProps>) {
    super.willUpdate(changedProperties);

    // if context updated
    if (changedProperties.has("weavy") && this.weavy) {
      this.updateConversationMutation = getUpdateConversationMutation(this.weavy);
      this.markConversationMutation = getMarkConversationMutation(this.weavy);
    }

    // conversationId is changed
    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("conversationId") ||
        changedProperties.has("componentFeatures")) &&
      this.weavy
    ) {
      this.#unsubscribeToRealtime?.();

      // Optimize pages cache for the conversation we're leaving
      const lastConversationId = changedProperties.get("conversationId");
      if (lastConversationId && lastConversationId > 0) {
        requestAnimationFrame(() => {
          keepPages(this.weavy?.queryClient, ["messages", lastConversationId], undefined, 1);
        });
      }

      if (this.conversationId && this.conversationId > 0) {
        this.membersQuery.trackQuery(getMemberOptions(this.weavy, this.conversationId, {}));
        this.botsQuery.trackQuery(getMemberOptions(this.weavy, this.conversationId, {}, true));

        await this.messagesQuery.trackInfiniteQuery(getMessagesOptions(this.weavy, this.conversationId));
        await this.addMessageMutation.trackMutation(
          getAddMessageMutationOptions(this.weavy, ["messages", this.conversationId])
        );

        this.pollMutation = getPollMutation(this.weavy, ["messages", this.conversationId]);

        // set initial value of unread messages banner
        this.lastReadMessageId = undefined;
        this.showNewMessages = false;

        const subscribeGroup = `a${this.conversationId}`;

        this.weavy.subscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);

        if (this.componentFeatures?.allowsFeature(Feature.Reactions)) {
          this.weavy.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
          this.weavy.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
        }

        if (this.componentFeatures?.allowsFeature(Feature.Receipts)) {
          this.weavy.subscribe(subscribeGroup, "app_marked", this.handleRealtimeMarked);
        }

        this.#unsubscribeToRealtime = () => {
          this.weavy?.unsubscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
          this.weavy?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
          this.weavy?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
          this.weavy?.unsubscribe(subscribeGroup, "app_marked", this.handleRealtimeMarked);
          this.#unsubscribeToRealtime = undefined;
        };
      } else {
        this.messagesQuery.untrackInfiniteQuery();
        this.addMessageMutation.untrackMutation();
        this.membersQuery.untrackQuery();
        this.botsQuery.untrackQuery();
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
            (oldConversation?.last_message.id !== this.conversation?.last_message.id &&
              (this.shouldBeAtBottom || this.isAtBottom))
          ) {
            this.markAsRead();
          }
        } else if (oldConversation?.id !== this.conversation?.id) {
          // hide new messages
          this.showNewMessages = false;
        }
      }
    }

    // Update context data refs
    if (changedProperties.has("contextData") && this.contextData) {
      const prevContextDataRefs = this.contextDataRefs;
      this.contextDataRefs = new Map();

      // Add items
      this.contextData.forEach((dataItem) => {
        const prevItem = prevContextDataRefs.get(dataItem);
        if (prevItem) {
          this.contextDataRefs.set(dataItem, prevItem);
        } else {
          const dataRef = getContextDataRef(dataItem);
          if (dataRef) {
            //console.log("context data item", dataRef);
            this.contextDataRefs.set(dataItem, dataRef);
          }
        }
      });
    }

    // Update title
    if (!this.conversation?.name && !isInfiniteResultDataEmpty(this.messagesQuery.result.data)) {
      const messages = getFlatInfiniteResultData(this.messagesQuery.result.data);
      // special handing of bot chat?
      const lastPlainMessage = messages.find((message) => message.plain);

      if (lastPlainMessage) {
        this.setEmptyConversationTitle(getTitleFromText(lastPlainMessage.plain));
      }
    }
  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.messagesQuery.result, this.pagerRef.value);
  }

  renderConversationHeader() {
    if (!this.header) {
      return html` <!-- Top of the conversation --> `;
    }

    const { isPending: messagesIsPending, hasNextPage } = this.messagesQuery.result ?? {};

    if (!this.conversation || messagesIsPending || hasNextPage) {
      return nothing;
    }

    const { data: membersData } = this.membersQuery.result ?? {};

    const otherMember =
      this.user && this.isPrivateChat()
        ? (this.conversation?.members?.data || []).filter((member) => member.id !== this.user?.id)?.[0] ?? this.user
        : null;

    return html`
      <wy-avatar-header>
        ${this.conversation.avatar_url
          ? html`<wy-avatar .size=${96} src=${this.conversation.avatar_url}></wy-avatar>`
          : this.isChatRoom()
          ? html` <wy-avatar-group
              .members=${membersData?.data}
              title=${this.conversation.name}
              .size=${96}
            ></wy-avatar-group>`
          : otherMember?.avatar_url
          ? html`
              <wy-avatar
                src=${ifDefined(otherMember?.avatar_url)}
                name=${this.conversation.name}
                ?isBot=${otherMember?.is_bot}
                size=${96}
              ></wy-avatar>
            `
          : nothing}
      </wy-avatar-header>
    `;
  }

  override render() {
    const { isPending: networkIsPending } = this.weavy?.network ?? { isPending: true };
    const { data: infiniteData, isPending, hasNextPage } = this.messagesQuery.result ?? { isPending: networkIsPending };
    const { data: membersData } = this.membersQuery.result ?? {};
    const { data: botsData } = this.botsQuery.result ?? {};

    return html`
      ${this.renderConversationHeader()}
      ${this.conversation && infiniteData && !isInfiniteResultDataEmpty(infiniteData)
        ? html`
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
              ${hasNextPage
                ? html`<div slot="start" ${ref(this.pagerRef)} part="wy-pager wy-pager-top"></div>`
                : nothing}
              <wy-message-typing
                slot="end"
                .conversationId=${this.conversation.id}
                .userId=${this.user?.id}
                .isPrivateChat=${this.isPrivateChat()}
                .members=${membersData?.data}
                .bots=${botsData?.data}
                @typing=${(e: CustomEvent) => this.handleTyping(e)}
              ></wy-message-typing>
            </wy-messages>
          `
        : html`
            <div class="wy-messages">
              <wy-empty class="wy-pane">
                ${(isPending && this.conversationId) || this.isCreatingConversation
                  ? html`<wy-spinner overlay></wy-spinner>`
                  : html` <slot name="empty">${msg("Start the conversation!")}</slot> `}
              </wy-empty>
            </div>
          `}
      <div ${ref(this.bottomRef)}></div>
      <div part="wy-footerbar wy-footerbar-sticky">
        <wy-message-editor
          ${ref(this.editorRef)}
          .draft=${true}
          .contextDataRefs=${Array.from(this.contextDataRefs.values())}
          placeholder=${msg("Type a message...")}
          ?disabled=${this.conversation && !hasPermission(PermissionType.Create, this.conversation?.permissions)}
          @submit=${(e: CustomEvent) => this.handleSubmit(e)}
        ></wy-message-editor>
      </div>
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
