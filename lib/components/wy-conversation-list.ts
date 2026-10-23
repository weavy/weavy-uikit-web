import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { AppType, AppTypeGuid, AppsResultType } from "../types/app.types";
import { getAppListOptions } from "../data/app";
import { InfiniteData } from "@tanstack/query-core";
import {
  LeaveConversationMutationType,
  MarkConversationMutationType,
  PinConversationMutationType,
  RemoveConversationMutationType,
  StarConversationMutationType,
  TrashConversationMutationType,
  getLeaveConversationMutation,
  getMarkConversationMutation,
  getPinConversationMutation,
  getRemoveConversationMutation,
  getStarConversationMutation,
  getTrashConversationMutation,
} from "../data/conversation";
import { getFlatInfiniteResultData, hasInfiniteResultDataId, updateCacheItems } from "../utils/query-cache";
import { localized, msg } from "@lit/localize";
import { RealtimePresenceEventType } from "../types/realtime.types";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import {
  LeaveEventType,
  PinEventType,
  RemoveEventType,
  StarEventType,
  TrashEventType,
  BlockEventType,
} from "../types/app.events";
import { getUserBlockMutationOptions } from "../data/blocks";
import { consume } from "@lit/context";
import { FeaturePolicyContext, type ComponentFeaturePolicy } from "../contexts/features-context";
import { Feature } from "../types/features.types";
import { MessagesMarkEventType } from "../types/messages.events";
import { SearchEventType } from "../types/search.events";
import { ActionType } from "../types/action.types";
import { autoScrollRef } from "../utils/dom";

import conversationsCss from "../scss/components/conversations.scss";
import paneCss from "../scss/components/pane.scss";
import hostContentsCss from "../scss/host-contents.scss";
import pagerStyles from "../scss/components/pager.scss";

import "./ui/wy-progress-circular";
import "./ui/wy-button";
import "./ui/wy-search";
import "./wy-conversation-item";
import "./wy-empty";

declare global {
  interface HTMLElementTagNameMap {
    "wy-conversation-list": WyConversationList;
  }
}

/**
 * Displays a list of conversation items, with search and create conversation button.
 *
 * **Used sub components**
 *
 * - [`<wy-buttons>`](./ui/wy-button.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-search>`](./ui/wy-search.ts)
 * - [`<wy-conversation-item>`](./wy-conversation-item.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 *
 * @slot navigation - Any navigation actions placed in front of the search.
 * @slot actions - Any actions placed next to the search.
 *
 * @csspart wy-conversations - Outer wrapper for the conversation list.
 * @csspart wy-conversation-list - Inner wrapper for the conversation list.
 * @csspart wy-conversations-toolbar - Search/new/actions toolbar in the top of the list
 * @csspart wy-pane - Body for empty state.
 * @csspart wy-pane-body - Body for list empty state.
 * @csspart wy-pane-group - Body section for the list empty state.
 * @csspart wy-pager - Pager element for infinite scroll.
 * @csspart wy-pager-bottom - Bottom styling for the pager element.
 *
 * @fires {WyActionEventType} wy-action - Emitted when a conversation is selected (detail: { action: "select", app: { ... } })
 */
@customElement("wy-conversation-list")
@localized()
export class WyConversationList extends WeavySubComponent {
  static override styles = [conversationsCss, paneCss, hostContentsCss, pagerStyles];

  /**
   * Controller for exporting named shadow parts.
   *
   * @internal
   */
  protected exportParts = new ShadowPartsController(this);

  /**
   * The feature policy in effect, consumed from the surrounding block.
   *
   * `WeavySubComponent` does not carry one, unlike `WeavySubTypeComponent`, so it is consumed directly here.
   *
   * @internal
   */
  @consume({ context: FeaturePolicyContext, subscribe: true })
  @state()
  componentFeatures: ComponentFeaturePolicy | undefined;

  /** The id of the currently selected conversation */
  @property({ type: Number })
  conversationId?: number;

  /** The id of a conversation to load items around */
  @property({ type: Number })
  aroundConversationId?: number;

  /** The conversation type guids to show in the list. */
  @property({ type: Array })
  conversationTypes?: AppTypeGuid[] = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];

  /** Input text to search for. */
  @state()
  private searchText?: string = "";

  /**
   * Selects a conversation and triggers an action event.
   *
   * @param conversation - The conversation to select.
   */
  selectConversation(conversation: AppType | null) {
    this.conversationId = conversation?.id;
    this.dispatchAction({ action: ActionType.Select, app: conversation });
  }

  /**
   * The query data controller for the conversation list.
   *
   * @internal
   */
  conversationsQuery = new InfiniteQueryController<AppsResultType>(this);

  /**
   * Mutation for marking conversations (read/unread).
   *
   * @internal
   */
  private markConversationMutation?: MarkConversationMutationType;
  /**
   * Mutation for starring/unstarring conversations.
   *
   * @internal
   */
  private starConversationMutation?: StarConversationMutationType;
  /**
   * Mutation for pinning/unpinning conversations.
   *
   * @internal
   */
  private pinConversationMutation?: PinConversationMutationType;
  /**
   * Mutation for leaving a conversation.
   *
   * @internal
   */
  private leaveConversationMutation?: LeaveConversationMutationType;
  /**
   * Mutation for removing a conversation.
   *
   * @internal
   */
  private removeConversationMutation?: RemoveConversationMutationType;
  /**
   * Mutation for trashing a conversation.
   *
   * @internal
   */
  private trashConversationMutation?: TrashConversationMutationType;

  /**
   * Infinite scroll controller instance used to observe the pager node.
   *
   * @internal
   */
  private infiniteScroll = new InfiniteScrollController(this);

  /**
   * Reverse infinite scroll controller instance used to observe the pager node.
   *
   * @internal
   */
  private reverseInfiniteScroll = new InfiniteScrollController(this, true);

  /**
   * Ref for pager element used by the reverse infinite scroll controller.
   *
   * @internal
   */
  private previousPagerRef: Ref<HTMLElement> = createRef();

  /**
   * Ref for pager element used by the infinite scroll controller.
   *
   * @internal
   */
  private nextPagerRef: Ref<HTMLElement> = createRef();

  /** Refresh the conversation query */
  private handleRefresh = () => {
    void this.conversationsQuery.result.refetch();
  };

  /**
   * Updates member data when realtime presence is received.
   * @param data - Realtime presence event data
   */
  private handlePresenceChange = (data: RealtimePresenceEventType) => {
    if (!this.weavy) {
      return;
    }

    //console.info("presence", data)

    // payload returns a single id as a string instead of number[]
    if (!Array.isArray(data)) {
      data = [parseInt(data)];
    }

    const updateMembersInApps = (item: AppType) => {
      if (item.type !== AppTypeGuid.PrivateChat || !item.members) {
        return item;
      }
      const members = item.members.data ?? [];
      members.forEach((m) => {
        m.presence = data.indexOf(m.id) != -1 ? "active" : "away";
      });
      item.members.data = members;
      return item;
    };

    updateCacheItems<AppType>(
      this.weavy.queryClient,
      { queryKey: ["apps", "list"], exact: false },
      undefined,
      updateMembersInApps,
    );
  };

  /**
   * Marks a conversation as read.
   *
   * @param appId - The id of the conversation to mark.
   * @param messageId - Optional message id to set the marker to.
   */
  private async handleMark(app: AppType, messageId?: number | null) {
    await this.markConversationMutation?.mutate({ app, messageId, userId: this.user?.id });
  }

  /**
   * Sets a conversation as starred.
   *
   * @param appId -  The id of the conversation to star.
   * @param star - Whether to make the conversation starred.
   */
  private async handleStar(appId: number, star: boolean) {
    await this.starConversationMutation?.mutate({ appId, star });
  }

  /**
   * Blocks or unblocks the other member of a private chat.
   *
   * Built per user rather than held as a single tracked mutation, since the endpoint is keyed on the user being
   * blocked and each row in the list is a different one.
   *
   * @param userId - The id of the user to block or unblock.
   * @param block - Whether the user should be blocked or unblocked.
   */
  private async handleBlock(userId: number, block: boolean) {
    if (!this.weavy) {
      return;
    }
    const { mutationFn, onSettled } = getUserBlockMutationOptions(this.weavy, userId);
    await mutationFn({ block });
    await onSettled();
  }

  /**
   * Sets a conversation as pinned.
   *
   * @param appId - The id of the conversation to pin.
   * @param pin - Whether to make the conversation pinned.
   */
  private async handlePin(appId: number, pin: boolean) {
    await this.pinConversationMutation?.mutate({ appId, pin });
  }

  /**
   * Leave a conversation (for the current user).
   *
   * @param appId - The id of the conversation to leave.
   */
  private async handleLeaveConversation(appId: number) {
    if (this.conversationId === appId) {
      this.selectConversation(null);
    }
    const user = await this.whenUser();
    await this.leaveConversationMutation?.mutate({ appId, members: [user.id], userId: user.id });
    void this.conversationsQuery.result.refetch();
  }

  /**
   * Remove a conversation.
   *
   * @param appId - The id of the conversation to remove.
   */
  private async handleRemoveConversation(appId: number) {
    if (this.conversationId === appId) {
      this.selectConversation(null);
    }
    await this.removeConversationMutation?.mutate({ appId });
    void this.conversationsQuery.result.refetch();
  }

  /**
   * Trash a conversation.
   *
   * @param appId - The id of the conversation to trash.
   */
  private async handleTrashConversation(appId: number) {
    if (this.conversationId === appId) {
      this.selectConversation(null);
    }
    await this.trashConversationMutation?.mutate({ appId });
    void this.conversationsQuery.result.refetch();
  }

  /**
   * Unsubscribe function for realtime subscriptions.
   *
   * @internal
   */
  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (changedProperties.has("conversationId") || !this.aroundConversationId) {
      if (!hasInfiniteResultDataId(this.conversationsQuery.result.data, this.conversationId)) {
        this.aroundConversationId = this.conversationId;
      } else if (!this.conversationId) {
        this.aroundConversationId = undefined;
      }
    }

    if (
      (changedProperties.has("weavy") ||
        changedProperties.has("conversationTypes") ||
        changedProperties.has("aroundConversationId")) &&
      this.weavy
    ) {
      await this.conversationsQuery.trackInfiniteQuery(
        getAppListOptions(
          this.weavy,
          this.conversationTypes,
          undefined,
          {
            around: this.aroundConversationId,
            orderBy: "pinned_at desc,rev desc",
          },
          () => this.searchText,
        ),
      );
    }

    if (changedProperties.has("weavy") && this.weavy) {
      this.markConversationMutation = getMarkConversationMutation(this.weavy);
      this.starConversationMutation = getStarConversationMutation(this.weavy);
      this.pinConversationMutation = getPinConversationMutation(this.weavy);
      this.leaveConversationMutation = getLeaveConversationMutation(this.weavy);
      this.removeConversationMutation = getRemoveConversationMutation(this.weavy);
      this.trashConversationMutation = getTrashConversationMutation(this.weavy);

      this.#unsubscribeToRealtime?.();

      // realtime
      void this.weavy.subscribe(null, "app_created", this.handleRefresh);
      void this.weavy.subscribe(null, "message_created", this.handleRefresh);
      void this.weavy.subscribe(null, "member_added", this.handleRefresh);
      void this.weavy.subscribe(null, "online", this.handlePresenceChange);

      this.#unsubscribeToRealtime = () => {
        void this.weavy?.unsubscribe(null, "app_created", this.handleRefresh);
        void this.weavy?.unsubscribe(null, "message_created", this.handleRefresh);
        void this.weavy?.unsubscribe(null, "member_added", this.handleRefresh);
        void this.weavy?.unsubscribe(null, "online", this.handlePresenceChange);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  protected override update(changedProperties: PropertyValueMap<this>): void {
    super.update(changedProperties);
    this.reverseInfiniteScroll.observe(this.conversationsQuery.result, this.previousPagerRef.value);
    this.infiniteScroll.observe(this.conversationsQuery.result, this.nextPagerRef.value);
  }

  override async updated(changedProperties: PropertyValueMap<this & { searchText: string }>) {
    // searchText is changed but undefined on initial load
    if (
      changedProperties.has("searchText") &&
      changedProperties.get("searchText") !== undefined &&
      this.conversationsQuery.result
    ) {
      await this.conversationsQuery.result.refetch?.();
    }
  }

  private renderConversations(infiniteData?: InfiniteData<AppsResultType>) {
    if (infiniteData) {
      const flattenedPages = getFlatInfiniteResultData(infiniteData);

      return repeat(
        flattenedPages,
        (conversation) => conversation?.id,
        (conversation) => {
          const selected = this.conversationId === conversation.id;
          const autoScroll = selected && this.aroundConversationId === conversation.id
          return [
            html`<wy-conversation-item
              conversationId=${conversation?.id}
              .avatarUrl=${conversation?.avatar_url}
              .name=${conversation.name}
              .lastMessage=${conversation.last_message}
              .members=${conversation.members}
              .unread=${conversation.is_unread}
              .starred=${conversation.is_starred}
              .pinned=${conversation.is_pinned}
              .blocked=${conversation.is_blocked}
              .canBlock=${Boolean(this.componentFeatures?.allowsFeature(Feature.Block))}
              .type=${conversation.type}
              .selected=${selected}
              ${autoScroll ? ref(autoScrollRef({ block: "nearest", behavior: "instant" })) : nothing}
              @selected=${() => this.selectConversation(conversation)}
              @mark=${(e: MessagesMarkEventType) => this.handleMark(conversation, e.detail.messageId)}
              @star=${(e: StarEventType) => this.handleStar(e.detail.id, e.detail.star)}
              @pin=${(e: PinEventType) => this.handlePin(e.detail.id, e.detail.pin)}
              @leave=${(e: LeaveEventType) => this.handleLeaveConversation(e.detail.id)}
              @remove=${(e: RemoveEventType) => this.handleRemoveConversation(e.detail.id)}
              @trash=${(e: TrashEventType) => this.handleTrashConversation(e.detail.id)}
              @block=${(e: BlockEventType) => this.handleBlock(e.detail.userId, e.detail.block)}
            ></wy-conversation-item>`,
          ];
        },
      );
    }
    return nothing;
  }

  override render() {
    const { data: infiniteData, isPending, hasPreviousPage, hasNextPage } = this.conversationsQuery.result ?? {};

    return html`
      <div part="wy-conversations">
        <wy-buttons part="wy-conversations-toolbar" position="sticky">
          <slot name="navigation"></slot>
          <wy-search
            placeholder=${msg("Search for conversations...")}
            @search=${(e: SearchEventType) => (this.searchText = e.detail.query)}
          ></wy-search>
          <slot name="actions"></slot>
        </wy-buttons>

        <div part="wy-conversation-list">
          ${hasPreviousPage ? html`<div ${ref(this.previousPagerRef)} part="wy-pager wy-pager-top"></div>` : nothing}
          ${!isPending && this.user && infiniteData
            ? infiniteData.pages[0]?.count || this.searchText
              ? this.renderConversations(infiniteData)
              : html`
                  <div part="wy-pane-body">
                    <div part="wy-pane-group">
                      <wy-empty noNetwork>${msg("Create a conversation to get started.")}</wy-empty>
                    </div>
                  </div>
                `
            : html`<wy-empty><wy-progress-circular indeterminate padded></wy-progress-circular></wy-empty>`}
          ${hasNextPage ? html`<div ${ref(this.nextPagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
        </div>
      </div>
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
