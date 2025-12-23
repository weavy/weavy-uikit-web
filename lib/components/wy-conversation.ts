import { html, nothing, css, type PropertyValueMap } from "lit";
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
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { AppContext } from "../contexts/app-context";
import { provide } from "@lit/context";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { QueryController } from "../controllers/query-controller";
import { MembersResultType, MemberType } from "../types/members.types";
import { getMemberOptions } from "../data/members";
import { Feature } from "../types/features.types";
import { ifDefined } from "lit/directives/if-defined.js";
import { MetadataType } from "../types/lists.types";
import { getTitleFromText, truncateText } from "../utils/strings";
import { TypingEventType } from "../types/typing.events";
import { EditorSubmitEventType } from "../types/editor.events";
import { PollVoteEventType } from "../types/polls.events";
import { repeat } from "lit/directives/repeat.js";
import { keyed } from "lit/directives/keyed.js";
import { clickOnEnterAndConsumeOnSpace, clickOnSpace } from "../utils/keyboard";

import messagesCss from "../scss/components/messages.scss";
import footerbarCss from "../scss/components/footerbar.scss";
import paneCss from "../scss/components/pane.scss";
import pagerCss from "../scss/components/pager.scss";
import toastCss from "../scss/components/toast.scss";

import "./ui/wy-avatar";
import "./wy-empty";
import { WyMessageEditor } from "./wy-editor-message";
import "./wy-message-typing";
import "./ui/wy-progress-circular";

import "./ui/wy-item";
import "./ui/wy-icon";
import "./ui/wy-button";
import "./ui/wy-dropdown";
import "./ui/wy-skeleton";
import "./wy-message";

declare global {
  interface HTMLElementTagNameMap {
    "wy-conversation": WyConversation;
  }
}

/**
 * Displays a single conversation with a message editor and an optional start avatar.
 *
 * **Used sub components**
 *
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 * - [`<wy-avatar-header>`](./ui/wy-avatar.ts)
 * - [`<wy-avatar-group>`](./ui/wy-avatar.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-dropdown>`](./ui/wy-dropdown.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-editor-message>`](./wy-editor-message.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-item>`](./ui/wy-item.ts)
 * - [`<wy-message>`](./wy-message.ts)
 * - [`<wy-message-typing>`](./wy-message-typing.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-skeleton>`](./ui/wy-skeleton.ts)
 *
 * @slot empty - Content in the empty state.
 * @slot footerbar - Content in the footerbar.
 *
 * @csspart wy-pager - Pager for message infinite scroll.
 * @csspart wy-pager-top - Pager styling for top placement.
 * @csspart wy-messages - Wrapper for the conversation messages.
 * @csspart wy-pane - Pane for the empty state.
 * @csspart wy-footerbar - The footerbar where the editor is placed.
 * @csspart wy-footerbar-sticky - Styles for making the footerbar sticky.
 * @csspart wy-footerbar-floating - Styles for making the footerbar floating.
 * @csspart wy-messages - Wrapper for the messages list.
 * @csspart wy-message-date-separator - Date separator shown between message days.
 * @csspart wy-toast - Unread marker toast wrapper.
 * @csspart wy-toast-action - Modifier part for the unread marker action.
 * @csspart wy-fade - Modifier part used when fading the unread marker.
 * @csspart wy-show - Modifier part used when the unread marker is shown.
 *
 * @fires {WyActionEventType} wy-action - Emitted when an embed action button is triggered.
 * @fires {WyPreviewOpenEventType} wy-preview-open - Fired when a preview overlay is about to open.
 * @fires {WyPreviewCloseEventType} wy-preview-close - Fired when a preview overlay is closed.
 */
@customElement("wy-conversation")
@localized()
export class WyConversation extends WeavySubAppComponent {
  static override styles = [
    messagesCss,
    pagerCss,
    paneCss,
    footerbarCss,
    toastCss,
    css`
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
        flex: 1 1 auto;
      }
    `,
  ];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Conversation object provided to the component (overrides AppContext).
   *
   * @type {AppType | undefined}
   */
  @provide({ context: AppContext })
  @property({ attribute: false })
  conversation?: AppType;

  /**
   * Id of the conversation to load and display.
   */
  @property({ type: Number })
  conversationId?: number;

  /**
   * Whether to render the header area for the conversation.
   */
  @property({ type: Boolean })
  header: boolean = false;

  /**
   * Optional instructions passed to an AI agent for the conversation.
   */
  @property()
  agentInstructions?: string;

  /**
   * Placeholder text for the message editor.
   */
  @property()
  placeholder?: string;

  /**
   * Position of the unread marker in the message list.
   *
   * @internal
   */
  @state()
  lastReadMessagePosition: "above" | "below" = "below";

  /**
   * The id of the last read message used for rendering the unread marker.
   *
   * @internal
   */
  @state()
  lastReadMessageId?: number;

  /**
   * Whether the "new messages" banner should be shown.
   *
   * @internal
   */
  @state()
  showNewMessages: boolean = false;

  /**
   * Temporarily set when creating a conversation (optimistic UI).
   *
   * @internal
   */
  @state()
  isCreatingConversation: boolean = false;

  /**
   * Whether to show read receipts (presence of receivers).
   *
   * @internal
   */
  @state()
  showReadReceipts: boolean = false;

  /**
   * Optional factory to create a conversation when sending the first message.
   *
   * @internal
   * @type {(payload: Omit<MutateMessageProps, "app_id">) => Promise<AppType> | undefined}
   */
  createConversation?: (payload: Omit<MutateMessageProps, "app_id">) => Promise<AppType>;
  /**
   * Optional function to request metadata for a message before sending.
   *
   * @internal
   * @type {(payload: MutateMessageProps) => Promise<MetadataType | undefined> | undefined}
   */
  requestMetadata?: (payload: MutateMessageProps) => Promise<MetadataType | undefined>;

  /**
   * Intersection observer used to detect when the bottom sentinel is visible (for marking/scrolling).
   *
   * @internal
   */
  protected bottomObserver: IntersectionObserver | undefined;

  isPrivateChat(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.PrivateChat;
  }

  isChatRoom(conversation?: AppType) {
    return (conversation ?? this.conversation)?.type === AppTypeGuid.ChatRoom;
  }

  /**
   * Infinite query controller for loading messages.
   *
   * @internal
   */
  protected messagesQuery = new InfiniteQueryController<MessagesResultType>(this);
  /**
   * Query controller for loading members for the conversation.
   *
   * @internal
   */
  protected membersQuery = new QueryController<MembersResultType>(this);

  /**
   * Mutation for marking conversation as read/unread.
   *
   * @internal
   */
  protected markConversationMutation?: MarkConversationMutationType;
  /**
   * Mutation for updating conversation properties (name/avatar).
   *
   * @internal
   */
  protected updateConversationMutation?: UpdateConversationMutationType;
  /**
   * Mutation controller for poll votes used within this conversation.
   *
   * @internal
   */
  protected pollMutation?: PollMutationType;
  /**
   * Controller for adding messages.
   *
   * @internal
   */
  protected addMessageMutation = new MutationController<MessageType, Error, MutateMessageProps, unknown>(this);

  /**
   * Reverse infinite scroll controller (loads newest messages at bottom).
   *
   * @internal
   */
  protected infiniteScroll = new ReverseInfiniteScrollController(this);

  /**
   * Ref to the top pager element used for loading older messages.
   *
   * @internal
   */
  protected pagerRef: Ref<HTMLElement> = createRef();
  /**
   * Ref to the bottom sentinel element used for scrolling/marking behavior.
   *
   * @internal
   */
  protected bottomRef: Ref<HTMLElement> = createRef();
  /**
   * Ref to the message editor instance.
   *
   * @internal
   */
  protected editorRef: Ref<WyMessageEditor> = createRef();

  /**
   * Whether the viewport should stay pinned to bottom on updates.
   *
   * @internal
   */
  protected shouldBeAtBottom = true;
  /**
   * Whether another user is currently typing.
   *
   * @internal
   */
  protected isTyping = false;

  /**
   * Read-only helper returning whether the viewport is currently scrolled to the bottom.
   *
   * @internal
   */
  get isAtBottom() {
    return this.bottomRef.value ? isParentAtBottom(this.bottomRef.value) : true;
  }

  /**
   * Scroll the conversation to the bottom.
   *
   * @param smooth - Whether to perform a smooth scroll.
   * @returns Promise<void>
   *
   * @internal
   */
  async scrollToBottom(smooth: boolean = false) {
    if (this.bottomRef.value) {
      await whenElementVisible(this.bottomRef.value);
    }
    if (hasScroll(this.bottomRef.value) && this.conversationId && this.conversationId > 0) {
      requestAnimationFrame(() => {
        keepPages(this.weavy?.queryClient, ["messages", this.conversationId], undefined, 1);
      });
      await scrollParentToBottom(this.bottomRef.value, smooth);
    }
  }

  /**
   * Handle typing indicator events from child components.
   *
   * @internal
   * @param e - Typing event
   */
  protected handleTyping(e: TypingEventType) {
    this.isTyping = Boolean(e.detail.count);

    if (this.isTyping && this.isAtBottom) {
      requestAnimationFrame(() => {
        void this.scrollToBottom(true);
      });
    }
  }

  /**
   * Submit handler for the message editor. Adds a message and optionally creates a conversation first.
   *
   * @internal
   * @param e - Editor submit event
   * @returns Promise<MessageType>
   */
  protected async handleSubmit(e: EditorSubmitEventType) {
    // TODO: refactor outside of conv?

    if (!this.user) {
      throw new Error("Error submitting message. Missing user.");
    }

    const initialPayload: Omit<MutateMessageProps, "app_id"> = {
      text: e.detail.text,
      meeting_id: e.detail.meetingId,
      poll_options: e.detail.pollOptions,
      embed_id: e.detail.embedId,
      blobs: e.detail.blobs,
      user: this.user,
      context: e.detail.contextData,
    };

    if (this.agentInstructions) {
      initialPayload.metadata = {
        instructions: this.agentInstructions,
      };
    }

    if (!this.conversation && this.weavy && this.createConversation) {
      this.isCreatingConversation = true;
      // Create new agent conversation
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
      void this.scrollToBottom();
    });

    this.isCreatingConversation = false;

    return messageData;
  }

  /**
   * Set the editor text programmatically.
   *
   * @param text - Text to set in the editor.
   * @returns Promise<void>
   *
   * @internal
   */
  async setEditorText(text: string) {
    if (this.editorRef.value) {
      this.editorRef.value.text = text;
      await this.editorRef.value.updateComplete;
      await new Promise((r) => requestAnimationFrame(r));
    }
  }

  /**
   * Set metadata on the editor instance.
   *
   * @param metadata - Optional metadata object.
   * @returns Promise<void>
   *
   * @internal
   */
  async setEditorMetadata(metadata: MetadataType = {}) {
    await this.updateComplete;
    if (this.editorRef.value) {
      this.editorRef.value.metadata = metadata;
    }
  }

  /**
   * Select all content in the editor.
   *
   * @internal
   */
  async selectAllInEditor() {
    if (this.editorRef.value) {
      await this.updateComplete;
      await this.editorRef.value.updateComplete;
      this.editorRef.value?.selectAllContent();
    }
  }

  /**
   * Move the editor cursor to the end of the content.
   *
   * @internal
   */
  async setCursorLastInEditor() {
    if (this.editorRef.value) {
      await this.updateComplete;
      await this.editorRef.value.updateComplete;
      this.editorRef.value?.setCursorLast();
    }
  }

  /**
   * Focus the editor input.
   *
   * @internal
   */
  focusEditor() {
    if (this.editorRef.value) {
      this.editorRef.value?.focusInput();
    }
  }

  /**
   * Sets the conversation title when the conversation is empty, based on message text.
   *
   * @internal
   * @param name - Title string to set.
   * @returns Promise<void>
   */
  async setEmptyConversationTitle(name: string) {
    if (!this.conversation || this.conversation.name) {
      return;
    }

    name = truncateText(name);

    await this.updateConversationMutation?.mutate({ appId: this.conversation.id, name: name });
  }

  /**
   * Realtime handler for 'message_created' events.
   *
   * Updates local cache and handles read/unread logic.
   *
   * @internal
   */
  private handleRealtimeMessage = async (realtimeEvent: RealtimeMessageEventType) => {
    if (!this.weavy || !this.conversation || !(this.conversationId && this.conversationId > 0) || !this.user) {
      return;
    }

    await this.messagesQuery.observer?.getCurrentQuery().promise;

    const appUidOrId = realtimeEvent.message.app.uid ?? realtimeEvent.message.app.id;

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
    this.weavy.queryClient.setQueryData(["apps", appUidOrId], (app: AppType) =>
      app ? { ...app, last_message: realtimeEvent.message } : app
    );

    // 3. mark as read/unread (including updating both details and list cache)
    if (realtimeEvent.actor.id !== this.user.id) {
      if (this.isAtBottom) {
        // mark as read
        void this.markAsRead(realtimeEvent.message.id);
        requestAnimationFrame(() => {
          void this.scrollToBottom();
        });
      } else {
        // set is_unread in cache
        this.weavy.queryClient.setQueryData(["apps", appUidOrId], (app: AppType) =>
          app ? { ...app, is_unread: true } : app
        );

        this.lastReadMessagePosition = "above";
        this.lastReadMessageId = realtimeEvent.message.id;
        this.showNewMessages = true;
      }

      // update members cache to indicate that creator has seen the message
      updateCacheItems(
        this.weavy.queryClient,
        { queryKey: ["members", realtimeEvent.message.app.id], exact: false },
        realtimeEvent.actor.id,
        (item: MemberType) => {
          item.marked_id = realtimeEvent.message.id;
          item.marked_at = realtimeEvent.message.created_at;
        }
      );
    }
  };

  /**
   * Realtime handler for added reactions. Updates message reactions cache.
   *
   * @internal
   */
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

  /**
   * Realtime handler for removed reactions. Updates message reactions cache.
   *
   * @internal
   */
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

  /**
   * Realtime handler for app marked events (read receipts).
   *
   * @internal
   */
  private handleRealtimeMarked = (realtimeEvent: RealtimeAppMarkedEventType) => {
    if (!this.weavy || !this.conversation) {
      return;
    }

    updateCacheItems(
      this.weavy.queryClient,
      { queryKey: ["members", this.conversation.id] },
      realtimeEvent.actor.id,
      (item: MemberType) => {
        item.marked_id = realtimeEvent.marked_id;
        item.marked_at = realtimeEvent.marked_at;
      }
    );
  };

  /**
   * Mark the conversation as read. Respects visibility and component lifecycle.
   *
   * @param messageId - Optional message id to mark as read.
   * @returns Promise<void>
   *
   * @internal
   */
  async markAsRead(messageId?: number) {
    await whenDocumentVisible();

    await Promise.race([whenElementVisible(this), whenConnected(this, false)]);

    if (!this.componentFeatures?.allowsFeature(Feature.Receipts) || !this.isConnected) {
      return;
    }

    if (this.conversation && this.conversation.last_message) {
      await this.markConversationMutation?.mutate({
        app: this.conversation,
        messageId: messageId ?? this.conversation.last_message.id,
        userId: this.user?.id,
      });
    }
  }

  /**
   * Handler bound to document visibility/scroll events that triggers markAsRead when appropriate.
   *
   * @internal
   */
  protected markAsReadHandler = () => {
    if (!document.hidden && this.isAtBottom) {
      void this.markAsRead();
    }
  };

  /**
   * Unsubscribe function for realtime subscriptions.
   *
   * @internal
   */
  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
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
        await this.messagesQuery.trackInfiniteQuery(getMessagesOptions(this.weavy, this.conversationId));
        await this.addMessageMutation.trackMutation(
          getAddMessageMutationOptions(this.weavy, ["messages", this.conversationId])
        );

        await this.membersQuery.trackQuery(getMemberOptions(this.weavy, this.conversationId, {}));

        this.pollMutation = getPollMutation(this.weavy, this.conversationId, ["messages", this.conversationId]);

        // set initial value of unread messages banner
        this.lastReadMessageId = undefined;
        this.showNewMessages = false;

        const subscribeGroup = `a${this.conversationId}`;

        void this.weavy.subscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);

        if (this.componentFeatures?.allowsFeature(Feature.Reactions)) {
          void this.weavy.subscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
          void this.weavy.subscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
        }

        if (this.componentFeatures?.allowsFeature(Feature.Receipts)) {
          void this.weavy.subscribe(subscribeGroup, "app_marked", this.handleRealtimeMarked).then((showReceipts) => {
            this.showReadReceipts = showReceipts;
          });
        }

        this.#unsubscribeToRealtime = () => {
          void this.weavy?.unsubscribe(subscribeGroup, "message_created", this.handleRealtimeMessage);
          void this.weavy?.unsubscribe(subscribeGroup, "reaction_added", this.handleRealtimeReactionAdded);
          void this.weavy?.unsubscribe(subscribeGroup, "reaction_removed", this.handleRealtimeReactionDeleted);
          void this.weavy?.unsubscribe(subscribeGroup, "app_marked", this.handleRealtimeMarked);
          this.showReadReceipts = false;
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
        if (this.componentFeatures?.allowsFeature(Feature.Receipts) && this.conversation?.is_unread) {
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
            void this.markAsRead();
          }
        } else if (oldConversation?.id !== this.conversation?.id) {
          // hide new messages
          this.showNewMessages = false;
        }
      }
    }

    // Update title
    if (this.conversation && !this.conversation?.name && !isInfiniteResultDataEmpty(this.messagesQuery.result.data)) {
      const messages = getFlatInfiniteResultData(this.messagesQuery.result.data);
      // REVIEW: special handing of agent chat?
      const lastPlainMessage = messages.find((message) => message.plain);
      if (lastPlainMessage) {
        void this.setEmptyConversationTitle(getTitleFromText(lastPlainMessage.plain));
      }
    }
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
      <wy-avatar-header description=${ifDefined(otherMember?.comment)}>
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
                description=${ifDefined(otherMember?.comment)}
                ?isAgent=${otherMember?.is_agent}
                size=${96}
              ></wy-avatar>
            `
          : nothing}
      </wy-avatar-header>
    `;
  }

  renderMessages() {
    const { isPending: networkIsPending } = this.weavy?.network ?? { isPending: true };
    const {
      data: infiniteMessages,
      isPending,
      //hasNextPage,
    } = this.messagesQuery.result ?? { isPending: networkIsPending };
    const { data: members } = this.membersQuery.result ?? {};
    const flattenedPages = getFlatInfiniteResultData(infiniteMessages);

    let lastDate: Date;

    return this.conversation && infiniteMessages && !isInfiniteResultDataEmpty(infiniteMessages)
      ? html`
          <div part="wy-messages">
            <div ${ref(this.pagerRef)} part="wy-pager wy-pager-top"></div>

            ${flattenedPages && this.conversation && this.user
              ? repeat(
                  flattenedPages,
                  (message) => message.id,
                  (message, _index) => {
                    const messageDate = new Date(message.created_at);

                    let dateContent = html``;
                    if (lastDate?.toDateString() !== messageDate.toDateString()) {
                      const messageDateShort = new Intl.DateTimeFormat(this.weavy?.locale, {
                        dateStyle: "short",
                      }).format(messageDate);
                      lastDate = messageDate;
                      dateContent = html`<time part="wy-message-date-separator">${messageDateShort}</time>`;
                    }

                    let unreadMarkerContent = html``;
                    if (this.lastReadMessageId && this.lastReadMessageId === message.id) {
                      unreadMarkerContent = html`<div
                        id="unread-marker"
                        part="wy-toast wy-toast-action wy-fade ${this.showNewMessages ? "wy-show" : ""}"
                        tabindex=${this.showNewMessages ? 0 : -1}
                        @click=${() => {
                          let selector = `#message-${this.lastReadMessageId}`;
                          if (this.lastReadMessagePosition === "below") {
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

                    // Get additional member data
                    const createdBy = members?.data?.find((m) => m.id === message.created_by.id) || message.created_by;

                    return html`${[
                      html`${dateContent}`,
                      html`${this.lastReadMessagePosition === "above" ? unreadMarkerContent : nothing}`,
                      keyed(
                        `message-${message.id}`,
                        html`<wy-message
                          id="message-${message.id}"
                          .conversation=${this.conversation}
                          .messageId=${message.id}
                          .me=${createdBy.id === this.user?.id}
                          .isAgent=${createdBy.is_agent || false}
                          .isPrivateChat=${this.conversation?.type === AppTypeGuid.PrivateChat ||
                          this.conversation?.type === AppTypeGuid.AgentChat}
                          .name=${createdBy.name}
                          .comment=${createdBy.comment}
                          .avatar=${createdBy.avatar_url}
                          .createdAt=${message.created_at}
                          .text=${message.plain}
                          .html=${message.html}
                          .annotations=${message.annotations?.data}
                          .attachments=${message.attachments?.data}
                          .meeting=${message.meeting}
                          .pollOptions=${message.options?.data}
                          .embed=${message.embed}
                          .reactions=${message.reactions?.data}
                          .seenBy=${this.showReadReceipts && members && members.data && members.data.length > 0
                            ? members.data.filter((member) => {
                                return member.marked_id === message.id && member.id !== this.user?.id;
                              })
                            : []}
                          @vote=${(e: PollVoteEventType) => {
                            if (e.detail.parentId) {
                              if (e.detail.parentType && e.detail.parentId) {
                                void this.pollMutation?.mutate({
                                  optionId: e.detail.optionId,
                                  parentType: e.detail.parentType,
                                  parentId: e.detail.parentId,
                                });
                              }
                              //this.dispatchVote(e.detail.optionId, e.detail.parentId);
                            }
                          }}
                        ></wy-message>`
                      ),
                      html`${this.lastReadMessagePosition === "below" ? unreadMarkerContent : nothing}`,
                    ]}`;
                  }
                )
              : nothing}
            ${this.componentFeatures?.allowsFeature(Feature.Typing)
              ? html`
                  <wy-message-typing
                    .conversationId=${this.conversation.id}
                    .userId=${this.user?.id}
                    .isPrivateChat=${this.isPrivateChat()}
                    .members=${members?.data ?? []}
                    @typing=${(e: TypingEventType) => this.handleTyping(e)}
                  ></wy-message-typing>
                `
              : nothing}
          </div>
        `
      : html`
          <div part="wy-messages">
            <wy-empty part="wy-pane">
              ${(isPending && this.conversationId) || this.isCreatingConversation
                ? html`<wy-progress-circular indeterminate overlay></wy-progress-circular>`
                : html` <slot name="empty">${this.conversationId ? msg("Start the conversation!") : nothing}</slot> `}
            </wy-empty>
          </div>
        `;
  }

  override render() {
    return html`
      ${this.renderConversationHeader()} ${this.renderMessages()}
      <div ${ref(this.bottomRef)}></div>
      <div part="wy-footerbar wy-footerbar-sticky wy-footerbar-floating">
        <slot name="footerbar"></slot>
        <wy-message-editor
          ${ref(this.editorRef)}
          .draft=${true}
          placeholder=${this.placeholder ?? msg("Type a message...")}
          ?disabled=${this.conversation && !hasPermission(PermissionType.Create, this.conversation?.permissions)}
          @submit=${(e: EditorSubmitEventType) => this.handleSubmit(e)}
        ></wy-message-editor>
      </div>
    `;
  }

  override updated() {
    if (this.shouldBeAtBottom) {
      keepPages(this.weavy?.queryClient, ["messages", this.conversationId], undefined, 1);
      requestAnimationFrame(() => {
        void this.scrollToBottom();
      });
    }

    if (!this.bottomObserver) {
      this.bottomObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (!this.isTyping && this.conversation?.is_unread) {
              void this.markAsRead();
            }
          }
        });
      });
    }
    if (this.bottomRef && this.bottomRef.value) {
      this.bottomObserver.observe(this.bottomRef.value);
    }

    this.infiniteScroll.observe(this.messagesQuery.result, this.pagerRef.value);
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
