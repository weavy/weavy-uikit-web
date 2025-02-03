import { AppTypeString, ComponentType, EntityType, LinkType } from "./app.types";
import { MetadataType } from "./lists.types";
import { InfiniteQueryResultType } from "./query.types";
import { RealtimeNotificationsEventDetailType } from "./realtime.types";
import { UserType } from "./users.types";

export type NotificationType = {
  /** The id of the notification. */
  id: number;
  /** Notification type, e.g. *activity*, *mention* or *reaction*. */
  type: NotificationTypes;
  /** The type of action that triggered the notification. */
  action: string;
  /** The user that performed the action that triggered the notification. */
  actor: UserType;
  /** The notification template string. */
  template: string;
  /** The arguments used to format *template* into a (localized) string. */
  args: string[];
  /** The formatted (and localized) notification text. */
  text: string;
  /** The notification text as html. */
  html: string;
  /** The notification text as plain text. */
  plain: string;
  /** The entity the notification regards. */
  link: EntityType;
  /** An url to open when clicking on the notification. */
  url: string;
  /** The notification recipient. */
  user: UserType;
  /** Additional metadata. */
  metadata: MetadataType;
  /** Date and time (UTC) the notification was created. */
  created_at: string;
  /** Date and time (UTC) the notification was last modified. */
  updated_at?: string;
  /** If the notification is unread or not. */
  is_unread?: boolean;
};

export type FormattedNotificationType = NotificationType & {
  link: LinkType;
  title: string;
  detail?: string;
  lang: NotificationOptions["lang"];
};

/** Notification type, e.g. *activity*, *mention* or *reaction*. */
export enum NotificationTypes {
  All = "",
  Activity = "activity",
  Mention = "mention",
  Reaction = "reaction",
}

export type NotificationsResultType = InfiniteQueryResultType<NotificationType>;

export type NotificationsAppearanceType = "button-list" | "none";
export type NotificationsBadgeType = "count" | "dot" | "none";
export type NotificationsToastsType = "browser" | "none";

export type WyLinkEventType = CustomEvent<{
  /** Link with entity data. */
  link: LinkType;

  /** Readable app type string. */
  app_type?: AppTypeString | ComponentType;

  /** The name of the context where the app lives. */
  source_name?: string;

  /** Url to the context where the app lives. */
  source_url?: string;

  /** Any additional data needed to show the app in the context where it lives. */
  source_data?: string;
}> & { type: "wy-link" };

/**
 * Realtime notifications event.
 */
export type WyNotificationsEventType = CustomEvent<RealtimeNotificationsEventDetailType> & { type: "wy-notifications" };

/**
 * Notification event.
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
