import { html, nothing, css, type PropertyValueMap, LitElement } from "lit";
import { customElement } from "../utils/decorators/custom-element";
import { property, queryAssignedElements, state } from "lit/decorators.js";
import { Ref, createRef, ref } from "lit/directives/ref.js";
import { repeat } from "lit/directives/repeat.js";
import { InfiniteScrollController } from "../controllers/infinite-scroll-controller";
import { InfiniteQueryController } from "../controllers/infinite-query-controller";
import type { UserType } from "../types/users.types";
import { InfiniteData } from "@tanstack/query-core";
import { getFlatInfiniteResultData, updateCacheItem } from "../utils/query-cache";
import { localized, msg } from "@lit/localize";
import type { RealtimeNotificationEventType, RealtimePresenceEventType } from "../types/realtime.types";
import { WeavySubAppComponent } from "../classes/weavy-sub-app-component";
import { ShadowPartsController } from "../controllers/shadow-parts-controller";
import { type NotificationType, NotificationTypes, type NotificationsResultType } from "../types/notifications.types";
import type {
  NotificationFilterEventType,
  NotificationMarkEventType,
  NotificationSelectEventType,
} from "../types/notifications.events";
import { getMarkNotificationMutation, getNotificationsOptions } from "../data/notifications";
import { NamedEvent } from "../types/generic.types";
import { ActionType } from "../types/action.types";
import { WyActionEventType } from "../types/action.events";

import paneCss from "../scss/components/pane.scss";
import pagerCss from "../scss/components/pager.scss";

import "./wy-notification-list-item";
import "./ui/wy-icon";
import "./ui/wy-presence";
import "./ui/wy-avatar";
import "./wy-empty";
import "./ui/wy-progress-circular";
import "./ui/wy-button";

declare global {
  interface HTMLElementTagNameMap {
    "wy-notification-list": WyNotificationList;
    "wy-notification-header": WyNotificationHeader;
  }
}

/**
 * Displays a list of notifications with tabs and paging.
 *
 * **Used sub components:**
 *
 * - [`<wy-buttons>`](./ui/wy-buttons.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 * - [`<wy-icon>`](./ui/wy-icon.ts)
 * - [`<wy-notification-list-item>`](./wy-notification-list-item.ts)
 * - [`<wy-empty>`](./wy-empty.ts)
 * - [`<wy-progress-circular>`](./ui/wy-progress-circular.ts)
 * - [`<wy-presence>`](./ui/wy-presence.ts)
 * - [`<wy-avatar>`](./ui/wy-avatar.ts)
 *
 * @slot buttons - Extra buttons to render in the toolbar.
 * @slot empty - Fallback content when there are no notifications.
 *
 * @csspart wy-pane-toolbar - Toolbar area containing tabs and actions.
 * @csspart wy-pane-body - Body wrapper for the list.
 * @csspart wy-pane-group - Group wrapper inside the pane body.
 * @csspart wy-pager - Pager container.
 * @csspart wy-pager-bottom - Pager modifier for bottom placement.
 *
 * @fires {WyActionEventType} wy-action - Emitted when a notification is selected.
 */
@customElement("wy-notification-list")
@localized()
export class WyNotificationList extends WeavySubAppComponent {
  static override styles = [
    paneCss,
    pagerCss,
    css`
      :host {
        position: relative;
      }
    `,
  ];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * Identifier of the notification that should appear selected.
   */
  @property({ type: Number })
  notificationId?: number;

  /**
   * Active notification filter.
   *
   * @type {"" | "activity" | "mention" | "reaction"}
   * @default ""
   */
  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  /**
   * Infinite query controller providing paged notifications.
   *
   * @internal
   */
  notificationsQuery = new InfiniteQueryController<NotificationsResultType>(this);

  /**
   * Mutation handler used to mark notifications read or unread.
   *
   * @internal
   */
  private markNotificationMutation?: ReturnType<typeof getMarkNotificationMutation>;

  /**
   * Intersection observer driving infinite scrolling.
   *
   * @internal
   */
  private infiniteScroll = new InfiniteScrollController(this);

  /**
   * Pager sentinel element for infinite scrolling.
   *
   * @internal
   */
  private pagerRef: Ref<HTMLElement> = createRef();

  /**
   * Mark or unmark a notification as read.
   *
   * @param notificationId - Target notification id.
   * @param markAsRead - Desired read state.
   */
  async markAsRead(notificationId: number, markAsRead: boolean = true) {
    await this.markNotificationMutation?.mutate({ notificationId, markAsRead });
  }

  /**
   * Select the provided notification and emit a `wy-action` event.
   *
   * @internal
   * @param notification - Notification to select.
   */
  private selectNotification(notification: NotificationType) {
    this.notificationId = notification.id;
    this.dispatchAction(ActionType.Select, notification);
  }

  /**
   * Triggers `wy-action` event.
   *
   * @internal
   * @param action - The performed action.
   * @param notification - Selected notification payload.
   * @returns Whether the event was successful.
   */
  private dispatchAction(action: ActionType, notification: NotificationType | null) {
    const event: WyActionEventType = new (CustomEvent as NamedEvent)("wy-action", {
      detail: { action, notification },
      bubbles: true,
      composed: true,
    });
    return this.dispatchEvent(event);
  }

  /**
   * Refresh notifications when realtime updates arrive.
   *
   * @internal
   */
  private handleRefresh = (_e: RealtimeNotificationEventType) => {
    //console.log("realtime notification, refresh", e)
    void this.notificationsQuery.result.refetch();
  };

  /**
   * Update actor presence based on realtime status changes.
   *
   * @internal
   */
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
      member.presence = data.indexOf(member.id) != -1 ? "active" : "away";
      item.actor = member;
    });
  };

  /**
   * Active realtime unsubscribe callback, if any.
   *
   * @internal
   */
  #unsubscribeToRealtime?: () => void;

  protected override async willUpdate(changedProperties: PropertyValueMap<this>): Promise<void> {
    super.willUpdate(changedProperties);

    if (
      (changedProperties.has("weavy") || changedProperties.has("typeFilter") || changedProperties.has("app")) &&
      this.weavy
    ) {
      await this.notificationsQuery.trackInfiniteQuery(
        getNotificationsOptions(this.weavy, this.typeFilter, this.app?.id)
      );
    }

    if (changedProperties.has("weavy") && this.weavy) {
      this.markNotificationMutation = getMarkNotificationMutation(this.weavy);

      this.#unsubscribeToRealtime?.();

      // realtime
      void this.weavy.subscribe(null, "online", this.handlePresenceChange);
      void this.weavy.subscribe(null, "notification_created", this.handleRefresh);
      void this.weavy.subscribe(null, "notification_updated", this.handleRefresh);
      //void this.weavy.subscribe(null, "notification_deleted", this.handleRefresh);
      void this.weavy.subscribe(null, "notifications_marked", this.handleRefresh);

      this.#unsubscribeToRealtime = () => {
        void this.weavy?.unsubscribe(null, "online", this.handlePresenceChange);
        void this.weavy?.unsubscribe(null, "notification_created", this.handleRefresh);
        void this.weavy?.unsubscribe(null, "notification_updated", this.handleRefresh);
        //void this.weavy?.unsubscribe(null, "notification_deleted", this.handleRefresh);
        void this.weavy?.unsubscribe(null, "notifications_marked", this.handleRefresh);
        this.#unsubscribeToRealtime = undefined;
      };
    }
  }

  protected override update(changedProperties: PropertyValueMap<this>): void {
    super.update(changedProperties);
    this.infiniteScroll.observe(this.notificationsQuery.result, this.pagerRef.value);
  }

  /**
   * Render the notifications collection.
   *
   * @internal
   * @param user - Current user.
   * @param infiniteData - Notification pages.
   */
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
              @select=${(_e: NotificationSelectEventType) => this.selectNotification(notification)}
              @mark=${(e: NotificationMarkEventType) => this.markAsRead(e.detail.notificationId, e.detail.markAsRead)}
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
            <div class="wy-notifications">
              ${!isPending && this.user && infiniteData
                ? infiniteData.pages[0]?.count
                  ? this.renderNotifications(this.user, infiniteData)
                  : html`
                      <div part="wy-pane-body">
                        <div part="wy-pane-group">
                          <slot name="empty">
                            <wy-empty>${msg("No updates yet.")}</wy-empty>
                          </slot>
                        </div>
                      </div>
                    `
                : html`<wy-empty><wy-progress-circular indeterminate padded></wy-progress-circular></wy-empty>`}
              ${hasNextPage ? html`<div ${ref(this.pagerRef)} part="wy-pager wy-pager-bottom"></div>` : nothing}
            </div>
          `
        : html`<wy-empty part="wy-pane"><wy-progress-circular indeterminate overlay></wy-progress-circular></wy-empty>`}
    `;
  }

  override disconnectedCallback(): void {
    this.#unsubscribeToRealtime?.();
    super.disconnectedCallback();
  }
}

/**
 * A header with filtering for notifications.
 *
 * **Used sub components:**
 *
 * - [`<wy-buttons>`](./ui/wy-button.ts)
 * - [`<wy-button>`](./ui/wy-button.ts)
 *
 * @slot - Content to override the filtering buttons.
 * @slot actions - Additional action buttons next to the filtering buttons.
 *
 * @csspart wy-pane-toolbar - Toolbar area containing tabs and actions.
 *
 * @fires {NotificationFilterEventType} filter - Any user selected filter. Can be prevented.
 */
@customElement("wy-notification-header")
@localized()
export class WyNotificationHeader extends LitElement {
  static override styles = [
    paneCss,
    pagerCss,
    css`
      :host {
        position: relative;
      }
    `,
  ];

  /** @internal */
  protected exportParts = new ShadowPartsController(this);

  /**
   * The selected filtering.
   *
   * @type {"" | "activity" | "mention" | "reaction"}
   * @default ""
   */
  @property()
  typeFilter: NotificationTypes = NotificationTypes.All;

  /**
   * Currently active filter stored for local button state.
   *
   * @internal
   */
  @state()
  activeFilter: NotificationTypes = NotificationTypes.All;

  /**
   * Any nodes assigned to the `header` slot.
   *
   * @internal
   */
  @queryAssignedElements({ flatten: true, selector: ":not(slot)" })
  private _slotDefault!: Array<HTMLElement>;

  /**
   * Trigger `filter` event.
   *
   * @param typeFilter - Filter to emit.
   * @returns Whether the event was dispatched successfully.
   */
  dispatchFilter(typeFilter: NotificationTypes) {
    const event: NotificationFilterEventType = new (CustomEvent as NamedEvent)("filter", {
      detail: { typeFilter },
    });
    return this.dispatchEvent(event);
  }

  override render() {
    const hasDefaultSlot = Boolean(this._slotDefault.length);
    return html`
      <div part="wy-pane-toolbar">
        <slot @slotchange=${() => this.requestUpdate()}></slot>
        ${!hasDefaultSlot
          ? html`
              <wy-buttons tabs>
                <wy-button
                  ?active=${this.typeFilter === NotificationTypes.All}
                  @click=${() => {
                    if (this.dispatchFilter(NotificationTypes.All)) {
                      this.typeFilter = NotificationTypes.All;
                    }
                  }}
                  kind="tab"
                  small
                >
                  ${msg("All")}
                </wy-button>
                <wy-button
                  ?active=${this.typeFilter === NotificationTypes.Activity}
                  @click=${() => {
                    if (this.dispatchFilter(NotificationTypes.Activity)) {
                      this.typeFilter = NotificationTypes.Activity;
                    }
                  }}
                  kind="tab"
                  small
                >
                  ${msg("Activities")}
                </wy-button>
                <wy-button
                  ?active=${this.typeFilter === NotificationTypes.Mention}
                  @click=${() => {
                    if (this.dispatchFilter(NotificationTypes.Mention)) {
                      this.typeFilter = NotificationTypes.Mention;
                    }
                  }}
                  kind="tab"
                  small
                >
                  ${msg("Mentions")}
                </wy-button>
                <wy-button
                  ?active=${this.typeFilter === NotificationTypes.Reaction}
                  @click=${() => {
                    if (this.dispatchFilter(NotificationTypes.Reaction)) {
                      this.typeFilter = NotificationTypes.Reaction;
                    }
                  }}
                  kind="tab"
                  small
                >
                  ${msg("Reactions")}
                </wy-button>
              </wy-buttons>
            `
          : nothing}

        <slot name="actions" @slotchange=${() => this.requestUpdate()}></slot>
      </div>
    `;
  }
}
