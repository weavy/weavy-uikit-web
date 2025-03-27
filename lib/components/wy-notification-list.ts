import { LitElement, html, nothing, css, type PropertyValueMap } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import type { UserType } from "../types/users.types";
import { InfiniteData } from "@tanstack/query-core";
import { getFlatInfiniteResultData, updateCacheItem } from "../utils/query-cache";
import { localized, msg } from "@lit/localize";
import { RealtimeNotificationEventType, RealtimePresenceEventType } from "../types/realtime.types";
import { WeavyProps } from "../types/weavy.types";
import { WeavyComponentConsumerMixin } from "../classes/weavy-component-consumer-mixin";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { NotificationType, NotificationTypes, NotificationsResultType } from "../types/notifications.types";
import {
  getLastNotification,
  getMarkNotificationMutation,
  getMarkNotificationsMutation,
  getNotificationsOptions,
} from "../data/notifications";

import chatCss from "../scss/all.scss";
import pagerStyles from "../scss/components/pager.scss";

import "./wy-notification-list-item";
import "./base/wy-icon";
import "./base/wy-presence";
import "./base/wy-avatar";
import "./wy-empty";
import "./base/wy-spinner";
import "./base/wy-button";

@customElement("wy-notification-list")
@localized()
export default class WyNotificationList extends WeavyComponentConsumerMixin(LitElement) {
  static override styles = [
    chatCss,
    pagerStyles,
    css`
      :host {
        position: relative;
      }
    `,
  ];
  protected exportParts = new ShadowPartsController(this);

  @property({ type: Number })
  notificationId?: number;

  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  async markAllAsRead() {
    const weavy = await this.whenWeavy();
    const notificationId = getLastNotification(weavy, NotificationTypes.All, this.app?.id)?.id;
    await this.markNotificationsMutation?.mutate({ notificationId });
  }

  private async handleMark(markAsRead: boolean, notificationId: number) {
    await this.markNotificationMutation?.mutate({ markAsRead: markAsRead, notificationId });
  }

  private handleSelect(notification: NotificationType) {
    this.notificationId = notification.id;
  }

  notificationsQuery = new InfiniteQueryController<NotificationsResultType>(this);

  private markNotificationsMutation?: ReturnType<typeof getMarkNotificationsMutation>;
  private markNotificationMutation?: ReturnType<typeof getMarkNotificationMutation>;
  private infiniteScroll = new InfiniteScrollController(this);
  private pagerRef: Ref<HTMLElement> = createRef();

  private handleRefresh = (_e: RealtimeNotificationEventType) => {
    //console.log("realtime notification, refresh", e)
    this.notificationsQuery.result.refetch();
  };

  private handlePresenceChange = (data: RealtimePresenceEventType) => {
    if (!this.weavy) {
      return;
    }

    // payload returns a single id as a string instead of number[]
    if (!Array.isArray(data)) {
      data = [parseInt(data)];
    }

    updateCacheItem<NotificationType>(this.weavy.queryClient, ["notifications", "list"], undefined, (item) => {
      const member = item.actor;
      member.presence = (data as number[]).indexOf(member.id) != -1 ? "active" : "away";
      item.actor = member;
    });
  };

  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this & WeavyProps>) {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("typeFilter") || changedProperties.has("app")) &&
      this.weavy
    ) {
      this.notificationsQuery.trackInfiniteQuery(getNotificationsOptions(this.weavy, this.typeFilter, this.app?.id));
    }

    if ((changedProperties.has("weavy") || changedProperties.has("app")) && this.weavy) {
      this.markNotificationsMutation = getMarkNotificationsMutation(this.weavy, this.app?.id);
    }

    if (changedProperties.has("weavy") && this.weavy) {
      this.markNotificationMutation = getMarkNotificationMutation(this.weavy);

      this.#unsubscribeToRealtime?.();

      // realtime
      this.weavy.subscribe(null, "online", this.handlePresenceChange);
      this.weavy.subscribe(null, "notification_created", this.handleRefresh);
      this.weavy.subscribe(null, "notification_updated", this.handleRefresh);
      //this.weavy.subscribe(null, "notification_deleted", this.handleRefresh);
      this.weavy.subscribe(null, "notifications_marked", this.handleRefresh);

      this.#unsubscribeToRealtime = () => {
        this.weavy?.unsubscribe(null, "online", this.handlePresenceChange);
        this.weavy?.unsubscribe(null, "notification_created", this.handleRefresh);
        this.weavy?.unsubscribe(null, "notification_updated", this.handleRefresh);
        //this.weavy?.unsubscribe(null, "notification_deleted", this.handleRefresh);
        this.weavy?.unsubscribe(null, "notifications_marked", this.handleRefresh);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  protected override update(changedProperties: PropertyValueMap<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.notificationsQuery.result, this.pagerRef.value);
  }

  private renderNotifications(user: UserType, infiniteData?: InfiniteData<NotificationsResultType>) {
    if (infiniteData) {
      const flattenedPages = getFlatInfiniteResultData(infiniteData);

      return repeat(
        flattenedPages,
        (notification) => notification?.id,
        (notification) => {
          return [
            html`<wy-notification-list-item
              notificationId=${notification.id}
              .notification=${notification}
              .selected=${this.notificationId == notification.id}
              @select=${(_e: CustomEvent) => this.handleSelect(notification)}
              @mark=${(e: CustomEvent) => this.handleMark(e.detail.markAsRead, e.detail.notificationId)}
            ></wy-notification-list-item>`,
          ];
        }
      );
    }
    return nothing;
  }

  override render() {
    const { data: infiniteData, hasNextPage, isPending } = this.notificationsQuery.result ?? {};

    return html`
      ${this.user
        ? html`
            <div class="wy-pane-toolbar">
              <wy-buttons tabs>
                <wy-button
                  ?active=${this.typeFilter === NotificationTypes.All}
                  @click=${() => (this.typeFilter = NotificationTypes.All)}
                  kind="tab"
                  small
                >
                  ${msg("All")}
                </wy-button>
                <wy-button
                  ?active=${this.typeFilter === NotificationTypes.Activity}
                  @click=${() => (this.typeFilter = NotificationTypes.Activity)}
                  kind="tab"
                  small
                >
                  ${msg("Activities")}
                </wy-button>
                <wy-button
                  ?active=${this.typeFilter === NotificationTypes.Mention}
                  @click=${() => (this.typeFilter = NotificationTypes.Mention)}
                  kind="tab"
                  small
                >
                  ${msg("Mentions")}
                </wy-button>
                <wy-button
                  ?active=${this.typeFilter === NotificationTypes.Reaction}
                  @click=${() => (this.typeFilter = NotificationTypes.Reaction)}
                  kind="tab"
                  small
                >
                  ${msg("Reactions")}
                </wy-button>
              </wy-buttons>
              <wy-button
                slot="buttons"
                kind="icon"
                @click=${() => this.markAllAsRead()}
                title=${msg("Mark all as read")}
              >
                <wy-icon name="check-all"></wy-icon>
              </wy-button>
              <slot name="buttons"></slot>
            </div>

            <div class="wy-notifications">
              ${!isPending && this.user && infiniteData
                ? infiniteData.pages[0]?.count
                  ? this.renderNotifications(this.user, infiniteData)
                  : html`
                      <div class="wy-pane-body">
                        <div class="wy-pane-group">
                          <slot name="empty">
                            <wy-empty>${msg("No updates yet.")}</wy-empty>
                          </slot>
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
