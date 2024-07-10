import { EntityType } from "./app.types";
import { MetadataType } from "./lists.types";
import { InfiniteQueryResultType } from "./query.types";
import { RealtimeNotificationEventType, RealtimeNotificationsEventType } from "./realtime.types";
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

export type WyLinkEventType = CustomEvent<EntityType>;

export type WyNotificationsEventType = CustomEvent<RealtimeNotificationEventType | RealtimeNotificationsEventType>;
