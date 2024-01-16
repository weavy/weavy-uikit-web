import { LitElement, type PropertyValues, html, nothing, css } from "lit";
import { customElement, property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { consume } from "@lit/context";
import { type WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { repeat } from "lit/directives/repeat.js";
import chatCss from "../scss/all.scss";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { ConversationsResultType } from "../types/conversations.types";
import { getApiOptions } from "../data/api";
import type { UserType } from "../types/users.types";
import { getConversationsOptions } from "../data/conversations";
import { InfiniteData } from "@tanstack/query-core";

import "./wy-conversation-list-item";
import "./wy-conversation-new";
import "./wy-presence";
import "./wy-avatar";
import "./wy-empty";
import "./wy-spinner";

import {
  LeaveConversationMutationType,
  MarkConversationMutationType,
  PinConversationMutationType,
  StarConversationMutationType,
  getLeaveConversationMutation,
  getMarkConversationMutation,
  getPinConversationMutation,
  getStarConversationMutation,
} from "../data/conversation";
import { updateCacheItem } from "../utils/query-cache";
import { ConversationType } from "../types/app.types";
import throttle from "lodash.throttle";
import { localized, msg } from "@lit/localize";
import { inputConsumeWithClearAndBlurOnEscape } from "../utils/keyboard";
import { QueryController } from "../controllers/query-controller";
import { RealtimePresenceEventType } from "../types/realtime.types";
import { WeavyContextProps } from "../types/weavy.types";

@customElement("wy-conversation-list")
@localized()
export default class WeavyConversationList extends LitElement {
  
  static override styles = [
    chatCss,
    css`
      :host{
        position: relative;
      }
    `
  ];
  _chatRoomId = "edb400ac-839b-45a7-b2a8-6a01820d1c44";

  @consume({ context: weavyContextDefinition, subscribe: true })
  @state()
  private weavyContext?: WeavyContext;

  @state()
  user?: UserType;

  @property()
  name?: string;

  @property({ type: Number })
  conversationId?: number;

  @state()
  private searchText?: string = "";

  private inputRef: Ref<HTMLInputElement> = createRef();

  conversationsQuery = new InfiniteQueryController<ConversationsResultType>(this);
  userQuery = new QueryController<UserType>(this);

  private markConversationMutation?: MarkConversationMutationType;
  private starConversationMutation?: StarConversationMutationType;
  private pinConversationMutation?: PinConversationMutationType;
  private leaveConversationMutation?: LeaveConversationMutationType;
  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<Element> = createRef();

  private handleRefresh = () => {
    this.conversationsQuery.result.refetch();
  };

  private handlePresenceChange = (data: RealtimePresenceEventType) => {
    if (!this.weavyContext) {
      return;
    }

    //console.info("presence", data)

    if (!Array.isArray(data)) {
      data = [data];
    }

    updateCacheItem(
      this.weavyContext.queryClient,
      ["conversations"],
      () => true,
      (item: ConversationType) => {
        const members = item.members.data;
        members.forEach((m) => {
          m.presence = (data as number[]).indexOf(m.id) != -1 ? "active" : "away";
        });
        item.members.data = members;
      }
    );
  };

  protected override async willUpdate(changedProperties: PropertyValues<this & WeavyContextProps>) {
    if (changedProperties.has("weavyContext") && this.weavyContext) {
      this.userQuery.trackQuery(getApiOptions<UserType>(this.weavyContext, ["user"]));

      this.conversationsQuery.trackInfiniteQuery(getConversationsOptions(this.weavyContext, {}, () => this.searchText));

      this.markConversationMutation = getMarkConversationMutation(this.weavyContext);
      this.starConversationMutation = getStarConversationMutation(this.weavyContext);
      this.pinConversationMutation = getPinConversationMutation(this.weavyContext);
      this.leaveConversationMutation = getLeaveConversationMutation(this.weavyContext);

      // realtime
      this.weavyContext.subscribe(null, "app_created", this.handleRefresh);
      this.weavyContext.subscribe(null, "member_added", this.handleRefresh);
      this.weavyContext.subscribe(null, "online", this.handlePresenceChange);
    }

    if (!this.userQuery.result?.isPending) {
      this.user = this.userQuery.result?.data;
    }
  }

  protected override update(changedProperties: PropertyValues<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.conversationsQuery.result, this.pagerRef.value);
  }

  override async updated(changedProperties: PropertyValues<this & { searchText: string }>) {
    if (changedProperties.has("searchText") && this.conversationsQuery.result) {
      await this.conversationsQuery.result.refetch();
    }
  }

  private dispatchSelected(id: number | undefined) {
    this.conversationId = id;
    const event = new CustomEvent("conversation-selected", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  private async handleMark(id: number, markAsRead: boolean, messageId: number) {
    const lastMessageId = markAsRead ? messageId : null;
    await this.markConversationMutation?.mutate({ id: id, markAsRead: markAsRead, messageId: lastMessageId });
    this.conversationsQuery.result.refetch();
  }

  private async handleStar(id: number, star: boolean) {
    await this.starConversationMutation?.mutate({ id: id, star: star });
    this.conversationsQuery.result.refetch();
  }

  private async handlePin(id: number, pin: boolean) {
    await this.pinConversationMutation?.mutate({ id: id, pin: pin });
    this.conversationsQuery.result.refetch();
  }

  private async handleLeaveConversation(id: number) {
    await this.leaveConversationMutation?.mutate({ id: id, members: [this.user!.id] });
    this.dispatchSelected(undefined);
    this.conversationsQuery.result.refetch();
  }

  private throttledSearch = throttle(
    async () => {
      this.searchText = this.inputRef.value?.value || "";
    },
    250,
    { leading: false, trailing: true }
  );

  private async clear() {
    this.searchText = "";
  }

  private renderConversations(user: UserType, infiniteData?: InfiniteData<ConversationsResultType>) {
    if (infiniteData) {
      const flattenedPages = infiniteData.pages.flatMap((conversationsResult) => conversationsResult.data);

      return repeat(
        flattenedPages,
        (conversation) => conversation.id,
        (conversation) => {
          return [
            html`<wy-conversation-list-item
              .conversationId=${conversation.id}
              .user=${this.user}
              .avatarUrl=${conversation.avatar_url}
              .displayName=${conversation.display_name}
              .lastMessage=${conversation.last_message}
              .members=${conversation.members}
              .unread=${conversation.is_unread}
              .starred=${conversation.is_starred}
              .pinned=${conversation.is_pinned}
              .room=${conversation.type === this._chatRoomId}
              .selected=${this.conversationId == conversation.id}
              @selected=${(e: CustomEvent) => this.dispatchSelected(e.detail.id)}
              @mark=${(e: CustomEvent) => this.handleMark(e.detail.id, e.detail.markAsRead, e.detail.messageId)}
              @star=${(e: CustomEvent) => this.handleStar(e.detail.id, e.detail.star)}
              @pin=${(e: CustomEvent) => this.handlePin(e.detail.id, e.detail.pin)}
              @leave=${(e: CustomEvent) => this.handleLeaveConversation(e.detail.id)}
              @refetch=${() => this.conversationsQuery.result.refetch()}
            ></wy-conversation-list-item>`,
          ];
        }
      );
    }
    return nothing;
  }

  override render() {
    const { data: infiniteData, isPending } = this.conversationsQuery.result ?? {};

    return html`
      ${this.user
        ? html`
            <header class="wy-appbars">
              <nav class="wy-appbar">
                <wy-avatar
                  .src=${this.user?.avatar_url}
                  .name=${this.user?.display_name}
                  .size=${24}
                  .presence=${this.user?.presence}
                ></wy-avatar>
                <div class="wy-appbar-text">${this.name ?? msg("Messenger")}</div>
                <wy-conversation-new
                  @refetch=${() => this.conversationsQuery.result.refetch()}
                  @selected=${(e: CustomEvent) => this.dispatchSelected(e.detail.id)}
                ></wy-conversation-new>
              </nav>
            </header>
            <div class="wy-pane-body">
              <div class="wy-search-form ">
                <div class="wy-pane-group">
                  <div class="wy-input-group">
                    <input
                      class="wy-search-input wy-input wy-input-group-input wy-input-filled"
                      name="text"
                      .value=${this.searchText || ""}
                      ${ref(this.inputRef)}
                      @input=${() => this.throttledSearch()}
                      @keyup=${inputConsumeWithClearAndBlurOnEscape}
                      placeholder=${msg("Search for conversations...")}
                    />
                    <wy-button
                      type="reset"
                      @click=${this.clear}
                      kind="icon"
                      class="wy-input-group-button-icon"
                      buttonClass="wy-button-icon"
                    >
                      <wy-icon name="close-circle"></wy-icon>
                    </wy-button>
                    <wy-button kind="icon" class="wy-input-group-button-icon" buttonClass="wy-button-icon">
                      <wy-icon name="magnify"></wy-icon>
                    </wy-button>
                  </div>
                </div>
              </div>
            </div>
            <div class="wy-conversations">
              ${!isPending && this.user && infiniteData
                ? this.renderConversations(this.user, infiniteData)
                : html`<wy-spinner class="wy-content-icon"></wy-spinner>`}
              <div ${ref(this.pagerRef)} class="wy-pager"></div>
            </div>
          `
        : html`<wy-empty class="wy-pane"><wy-spinner overlay></wy-spinner></wy-empty>`}
    `;
  }

  override disconnectedCallback(): void {
    if (this.weavyContext) {
      this.weavyContext.unsubscribe(null, "app_created", this.handleRefresh);
      this.weavyContext.unsubscribe(null, "member_added", this.handleRefresh);
      this.weavyContext.unsubscribe(null, "online", this.handlePresenceChange);
    }
    super.disconnectedCallback();
  }
}
