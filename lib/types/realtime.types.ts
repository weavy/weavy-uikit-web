import { AppRef, AppType, EntityType } from "./app.types";
import { CommentType } from "./comments.types";
import { FileType } from "./files.types";
import { PlainObjectType } from "./generic.types";
import { MemberType } from "./members.types";
import { MessageType } from "./messages.types";
import { PostType } from "./posts.types";
import { UserType } from "./users.types";
import { NotificationType } from "./notifications.types";

export type RealtimeDataType = PlainObjectType | number | string | Array<PlainObjectType | number | string>;

export type RealtimeEventType = {
  id: number;
  action: string;
  actor: UserType;
};

// APPS
export type RealtimeAppEventType = RealtimeEventType & {
  app: AppType;
};

export type RealtimeMemberEventType = RealtimeAppEventType & {
  member: MemberType;
};

export type RealtimeAppMarkedEventType = RealtimeAppEventType & {
  marked_at: string;
  marked_id: number;
};

// REACTIONS
export type RealtimeReactionEventType = RealtimeEventType & {
  reaction: string;
  entity: EntityType;
};

// CHAT
export type RealtimeMessageEventType = RealtimeEventType & {
  message: MessageType;
};

// POSTS
export type RealtimePostEventType = RealtimeEventType & {
  post: PostType;
};

// COMMENTS
export type RealtimeCommentEventType = RealtimeEventType & {
  comment: CommentType;
};

// FILES
export type RealtimeFileEventType = RealtimeEventType & {
  file: FileType;
};

// TYPING
export type RealtimeTypingEventType = RealtimeEventType & {
  entity: EntityType;
  type: EntityType["type"];
};

// PRESENCE
export type RealtimePresenceEventType = string | number[];

// NOTIFICATIONS
export type RealtimeNotificationEventType = RealtimeEventType & {
  action: "notification_created" | "notification_updated" | "notification_deleted";
  notification: NotificationType;
};

export type RealtimeNotificationsEventType = RealtimeEventType & {
  action: "notifications_marked";
  app?: AppRef;
};

export type RealtimeNotificationsEventDetailType = {
  action: "notification_created" | "notification_updated" | "notification_deleted" | "notifications_marked";
  notification?: NotificationType;
  app?: AppRef;
};
