import { EntityType } from "./app.types";
import { MetadataType } from "./lists.types";
import { InfiniteQueryResultType } from "./query.types";
import { UserOrAgentType, UserType } from "./users.types";

export type NotificationType = {
  /** The id of the notification. */
  id: number;
  /** Notification type, e.g. *activity*, *mention* or *reaction*. */
  type: NotificationTypes;
  /** The type of action that triggered the notification. */
  action: string;
  /** The user that performed the action that triggered the notification. */
  actor: UserOrAgentType;
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
  link?: EntityType;
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

export type NotificationsToastsType = "browser" | "none";
