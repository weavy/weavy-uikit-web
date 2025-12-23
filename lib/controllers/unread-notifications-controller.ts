import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import { QueryController } from "./query-controller";
import { NotificationsResultType, NotificationTypes } from "../types/notifications.types";
import { NamedEvent } from "../types/generic.types";
import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";
import { getLastNotification, getMarkNotificationsMutation, getUnreadOptions } from "../data/notifications";
import { QueryObserverResult } from "@tanstack/query-core";
import { WyUnreadEventType } from "../types/ui.events";

export interface UnreadNotificationsProps {
  /**
   * Number of unread notifications.
   */
  readonly unread: number;

  /**
   * Marks all notifications as read.
   */
  markAllAsRead: () => Promise<void>;
}

export interface NotificationFilterProps {
  /**
   * Optional app id for unread scoping.
   */
  appId?: number;

  /**
   * Type of notifications for the scope.
   *
   * @type "" | "activity" | "mention" | "reaction"
   */
  typeFilter: NotificationTypes;
}

/**
 * Lit element controller for Notification live data.
 *
 * - Requires a weavy context.
 * - May be filtered for different notification types and app id scopes.
 *
 * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread notifications change.
 */
export class UnreadNotificationsController implements ReactiveController, UnreadNotificationsProps, NotificationFilterProps {
  host: LitElement & ReactiveControllerHost;

  /**
   * Optional app id for unread scoping.
   */
  appId?: number;

  /**
   * Type of notifications for the scope.
   *
   * @type "" | "activity" | "mention" | "reaction"
   */
  typeFilter: NotificationTypes = NotificationTypes.All;

  #unread: number = 0;

  /**
   * The number of unread notifications for the current scope
   */
  get unread(): number {
    return this.#unread;
  }

  /**
   * Is the unread count pending?
   */
  get isUnreadPending(): boolean {
    return this.unreadQuery.result.isPending;
  }

  /**
   * The underlying query result for the unread count.
   */
  get unreadResult(): QueryObserverResult<NotificationsResultType> {
    return this.unreadQuery.result;
  }

  protected unreadQuery: QueryController<NotificationsResultType>;

  protected markNotificationsMutation?: ReturnType<typeof getMarkNotificationsMutation>;

  protected registrationRequested: boolean = false;

  // Weavy context
  protected weavyContext?: ContextConsumer<{ __context__: WeavyType }, LitElement>;
  protected whenWeavyContext: Promise<WeavyType>;
  protected resolveWeavyContext?: (value: WeavyType | PromiseLike<WeavyType>) => void;

  protected get weavy() {
    return this.weavyContext?.value;
  }

  constructor(host: LitElement) {
    host.addController(this);
    this.host = host;
    this.unreadQuery = new QueryController<NotificationsResultType>(host);
    this.whenWeavyContext = new Promise((r) => (this.resolveWeavyContext = r));
    void this.setContexts();
    void this.registerRealtime();
  }

  /**
   * Initiates context consumers
   */
  async setContexts() {
    await whenParentsDefined(this.host as LitElement);
    this.weavyContext = new ContextConsumer(this.host as LitElement, { context: WeavyContext, subscribe: true });
  }

  /**
   * Dispatch a `wy-unread` event on the host.
   *
   * @fires {WyUnreadEventType} wy-unread - Emitted when the number of unread notifications change.
   */
  dispatchNotificationUnreadEvent() {
    const event: WyUnreadEventType = new (CustomEvent as NamedEvent)("wy-unread", {
      detail: { unread: this.unread },
      bubbles: false,
      composed: true,
    });
    this.host.dispatchEvent(event);
  }

  /**
   * Request an update of the notification query data.
   */
  private handleRefresh = () => {
    void this.unreadQuery.result.refetch();
  };

  /**
   * Register realtime handlers.
   */
  async registerRealtime() {
    if (!this.registrationRequested) {
      this.registrationRequested = true;
      await this.whenWeavyContext;

      void this.weavy?.subscribe(null, "notification_created", this.handleRefresh);
      void this.weavy?.subscribe(null, "notification_updated", this.handleRefresh);
      //void this.weavy?.subscribe(null, "notification_deleted", this.handleRefresh);
      void this.weavy?.subscribe(null, "notifications_marked", this.handleRefresh);

      this.registrationRequested = false;
    }
  }

  /**
   * Unregister realtime handlers.
   *
   * @param skipAwait - Skip waiting for any context.
   */
  async unregisterRealtime(skipAwait: boolean = false) {
    if (!this.registrationRequested) {
      !skipAwait && (await this.whenWeavyContext);

      void this.weavy?.unsubscribe(null, "notification_created", this.handleRefresh);
      void this.weavy?.unsubscribe(null, "notification_updated", this.handleRefresh);
      //void this.weavy?.unsubscribe(null, "notification_deleted", this.handleRefresh);
      void this.weavy?.unsubscribe(null, "notifications_marked", this.handleRefresh);
    }
  }

  /**
   * Tracks unread data. Initiates the query data with the given filtering scope.
   *
   * @param typeFilter - The notification types to track.
   * @param appId - Optional app id for the filtering scope.
   */
  async track(typeFilter: NotificationTypes, appId?: number) {
    this.appId = appId;
    this.typeFilter = typeFilter;
    const weavy = await this.whenWeavyContext;
    this.markNotificationsMutation = getMarkNotificationsMutation(weavy, this.appId);
    await this.unreadQuery.trackQuery(getUnreadOptions(weavy, this.typeFilter, this.appId), true);
  }

  async markAllAsRead() {
    const weavy = await this.whenWeavyContext;
    const notificationId = getLastNotification(weavy, NotificationTypes.All, this.appId)?.id;
    await this.markNotificationsMutation?.mutate({ notificationId });
  }

  hostUpdate(): void {
    // Resolve any context promises
    if (this.weavyContext?.value) {
      this.resolveWeavyContext?.(this.weavyContext?.value);
    }

    const unreadCount = this.unreadQuery.result?.data?.count ?? 0;

    // Propagate and changes in the unread count.
    if (unreadCount !== this.unread) {
      this.#unread = unreadCount;
      this.dispatchNotificationUnreadEvent();
      this.host.requestUpdate();
    }
  }

  hostDisconnected() {
    if (this.weavy) {
      void this.unregisterRealtime(true);
    }
  }
}
