import { html, nothing, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import { AppType, AppTypeGuid, AppsResultType } from "../types/app.types";
import type { UserType } from "../types/users.types";
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
import { getFlatInfiniteResultData, updateCacheItems } from "../utils/query-cache";
import { localized, msg } from "@lit/localize";
import { RealtimePresenceEventType } from "../types/realtime.types";
import { WeavySubComponent } from "../classes/weavy-sub-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import {
  LeaveEventType,
  PinEventType,
  RemoveEventType,
  SelectedEventType,
  StarEventType,
  TrashEventType,
} from "../types/app.events";
import { MessagesMarkEventType } from "../types/messages.events";
import { NamedEvent } from "../types/generic.types";
import { SearchEventType } from "../types/search.events";

import conversationsCss from "../scss/components/conversations.scss";
import paneCss from "../scss/components/pane.scss";
import hostBlockCss from "../scss/host-block.scss";
import hostScrollYCss from "../scss/host-scroll-y.scss";
import pagerStyles from "../scss/components/pager.scss";

import "./wy-conversation-list-item";
import "./wy-conversation-new";
import "./base/wy-presence";
import "./base/wy-avatar";
import "./wy-empty";
import "./base/wy-spinner";
import "./base/wy-search";

@customElement("wy-conversation-list")
@localized()
export default class WeavyConversationList extends WeavySubComponent {
  static override styles = [
    conversationsCss,
    paneCss,
    hostBlockCss,
    hostScrollYCss,
    pagerStyles,
  ];
  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  conversationId?: number;

  @property({ type: Array })
  conversationTypes?: AppTypeGuid[] = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat];

  @property()
  agent?: string;

  @state()
  private searchText?: string = "";

  private dispatchSelected(id: number | undefined) {
    this.conversationId = id;
    const event: SelectedEventType = new (CustomEvent as NamedEvent)("selected", { detail: { id: id } });
    return this.dispatchEvent(event);
  }

  conversationsQuery = new InfiniteQueryController<AppsResultType>(this);

  private markConversationMutation?: MarkConversationMutationType;
  private starConversationMutation?: StarConversationMutationType;
  private pinConversationMutation?: PinConversationMutationType;
  private leaveConversationMutation?: LeaveConversationMutationType;
  private removeConversationMutation?: RemoveConversationMutationType;
  private trashConversationMutation?: TrashConversationMutationType;
  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();

  private handleRefresh = () => {
    void this.conversationsQuery.result.refetch();
  };

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
      const members = item.members.data ?? [];
      members.forEach((m) => {
        m.presence = data.indexOf(m.id) != -1 ? "active" : "away";
      });
      item.members.data = members;
    };

    updateCacheItems(
      this.weavy.queryClient,
      { queryKey: ["apps", "list"], exact: false },
      undefined,
      updateMembersInApps
    );
  };

  private async handleMark(appId: number, messageId?: number | null) {
    await this.markConversationMutation?.mutate({ appId, messageId, userId: this.user?.id });
  }

  private async handleStar(appId: number, star: boolean) {
    await this.starConversationMutation?.mutate({ appId, star });
  }

  private async handlePin(appId: number, pin: boolean) {
    await this.pinConversationMutation?.mutate({ appId, pin });
  }

  private async handleLeaveConversation(appId: number) {
    if (this.conversationId === appId) {
      this.dispatchSelected(undefined);
    }
    const user = await this.whenUser();
    await this.leaveConversationMutation?.mutate({ appId, members: [user.id] });
    void this.conversationsQuery.result.refetch();
  }

  private async handleRemoveConversation(appId: number) {
    if (this.conversationId === appId) {
      this.dispatchSelected(undefined);
    }
    await this.removeConversationMutation?.mutate({ appId });
    void this.conversationsQuery.result.refetch();
  }

  private async handleTrashConversation(appId: number) {
    if (this.conversationId === appId) {
      this.dispatchSelected(undefined);
    }
    await this.trashConversationMutation?.mutate({ appId });
    void this.conversationsQuery.result.refetch();
  }

  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if ((changedProperties.has("weavy") || changedProperties.has("conversationTypes")) && this.weavy) {
      await this.conversationsQuery.trackInfiniteQuery(
        getAppListOptions(
          this.weavy,
          {},
          this.conversationTypes,
          this.agent,
          () => this.searchText,
          "pinned_at desc,rev desc",
          false
        )
      );

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
    this.infiniteScroll.observe(this.conversationsQuery.result, this.pagerRef.value);
  }

  override async updated(changedProperties: PropertyValueMap<this & { searchText: string }>) {
    // searchText is changed but undefined on initial load
    if (changedProperties.has("searchText") && changedProperties.get("searchText") !== undefined && this.conversationsQuery.result) {
      await this.conversationsQuery.result.refetch?.();
    }
  }

  private renderConversations(user: UserType, infiniteData?: InfiniteData<AppsResultType>) {
    if (infiniteData) {
      const flattenedPages = getFlatInfiniteResultData(infiniteData);

      return repeat(
        flattenedPages,
        (conversation) => conversation?.id,
        (conversation) => {
          return [
            html`<wy-conversation-list-item
              .conversationId=${conversation?.id}
              .avatarUrl=${conversation?.avatar_url}
              .hideAvatar=${Boolean(this.agent)}
              .name=${conversation.name}
              .lastMessage=${conversation.last_message}
              .members=${conversation.members}
              .unread=${conversation.is_unread}
              .starred=${conversation.is_starred}
              .pinned=${conversation.is_pinned}
              .type=${conversation.type}
              .selected=${this.conversationId == conversation.id}
              @selected=${(e: SelectedEventType) => this.dispatchSelected(e.detail.id)}
              @mark=${(e: MessagesMarkEventType) => this.handleMark(e.detail.id, e.detail.messageId)}
              @star=${(e: StarEventType) => this.handleStar(e.detail.id, e.detail.star)}
              @pin=${(e: PinEventType) => this.handlePin(e.detail.id, e.detail.pin)}
              @leave=${(e: LeaveEventType) => this.handleLeaveConversation(e.detail.id)}
              @remove=${(e: RemoveEventType) => this.handleRemoveConversation(e.detail.id)}
              @trash=${(e: TrashEventType) => this.handleTrashConversation(e.detail.id)}
            ></wy-conversation-list-item>`,
          ];
        }
      );
    }
    return nothing;
  }

  override render() {
    const { data: infiniteData, isPending, hasNextPage } = this.conversationsQuery.result ?? {};

    return html`
      ${this.user
        ? html`
            <wy-buttons position=${this.agent ? "floating" : "sticky"} ?reverse=${Boolean(this.agent)}>
              ${this.agent
                ? nothing
                : html`
                    <wy-search
                      compact
                      placeholder=${msg("Search for conversations...")}
                      @search=${(e: SearchEventType) => (this.searchText = e.detail.query)}
                    ></wy-search>
                  `}
              <slot name="actions"></slot>
            </wy-buttons>

            <div class="wy-conversations">
              ${!isPending && this.user && infiniteData
                ? infiniteData.pages[0]?.count || this.searchText
                  ? this.renderConversations(this.user, infiniteData)
                  : html`
                      <div class="wy-pane-body">
                        <div class="wy-pane-group">
                          <wy-empty noNetwork>${msg("Create a conversation to get started.")}</wy-empty>
                        </div>
                      </div>
                    `
                : html`<wy-empty><wy-spinner padded></wy-spinner></wy-empty>`}
              ${hasNextPage ? html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
            </div>
          `
        : html`<wy-empty class="wy-pane"><wy-spinner overlay></wy-spinner></wy-empty>`}
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}
