import { AppTypeString, LinkType, UnknownAppType } from "./app.types";
import { MetadataType } from "./lists.types";
import { FormattedNotificationType, NotificationTypes } from "./notifications.types";
import { RealtimeNotificationsEventDetailType } from "./realtime.types";

// Local ShadowDOM events (composed: false, bubbling: true)

export type NotificationFilterEventType = CustomEvent<{
    typeFilter: NotificationTypes;
}> & { type: "filter" };

export type NotificationSelectEventType = CustomEvent<{
  notificationId: number;
}> & { type: "select" };

export type NotificationMarkEventType = CustomEvent<{
  notificationId: number;
  markAsRead: boolean;
}> & { type: "mark" };

export type NotificationHideEventType = CustomEvent & { type: "hide" };

export type NotificationCloseEventType = CustomEvent & { type: "close" };

// Public component API events (composed: true, bubbling: false)

export type WyLinkEventDetailType = {
  /** Link with entity data. */
  link?: LinkType;

  /** Readable app type string. */
  app_type?: AppTypeString | UnknownAppType;

  /** Optional additional metadata */
  metadata?: MetadataType

  /** The name of the context where the app lives. */
  source_name?: string;

  /** Url to the context where the app lives. */
  source_url?: string;

  /** Any additional data needed to show the app in the context where it lives. */
  source_data?: string;

};

/**
 * Fired when a notification is clicked.
 */
export type WyLinkEventType = CustomEvent<WyLinkEventDetailType> & { type: "wy-link" };

/**
 * Realtime notifications event. Fired when any notification is received.
 */
export type WyNotificationsEventType = CustomEvent<RealtimeNotificationsEventDetailType> & { type: "wy-notifications" };

/**
 * Fired when a notification should be shown.
 */
export type WyNotificationEventType = CustomEvent<FormattedNotificationType> & { type: "wy-notification" };

declare global {
  interface GlobalEventHandlersEventMap {
    /**
     * A 'wy-notifications' event can be emitted by the Weavy client instance on it's host when realtime notification events occur.
     */
    "wy-notifications": WyNotificationsEventType;
    
    /**
     * A 'wy-notification' event can be emitted when notification events occur.
     */
    "wy-notification": WyNotificationEventType;

    /**
     * A 'wy-link' event is emitted when navigation outside a weavy component is requested.
     */
    "wy-link": WyLinkEventType;
  }
}
