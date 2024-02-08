import { AppType, ConversationType, EntityType } from "./app.types";
import { CommentType } from "./comments.types";
import { FileType } from "./files.types";
import { PlainObjectType } from "./generic.types";
import { MemberType } from "./members.types";
import { MessageType } from "./messages.types";
import { PostType } from "./posts.types";
import { UserType } from "./users.types";

export type RealtimeDataType =  PlainObjectType | number | string | Array<PlainObjectType | number | string>;

export type RealtimeEventType = {
  id: number;
  action: string;
  actor: UserType;
};

// APPS
export type RealtimeAppEventType = RealtimeEventType & {
  app: AppType;
};

export type RealtimeMemberEventType = RealtimeEventType & {
  app: AppType;
  member: MemberType;
}

// REACTIONS
export type RealtimeReactionEventType = RealtimeEventType & {
  reaction: string;
  entity: EntityType;
};

// CHAT
export type RealtimeMessageEventType = RealtimeEventType & {
  message: MessageType;
};

export type RealtimeConversationMarkedEventType = RealtimeEventType & {
  conversation: ConversationType;
  marked_at: string;
  marked_id: number;
};

export type RealtimeConversationDeliveredEventType = RealtimeEventType & {
  conversation: ConversationType;
  delivered_at: string;
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
export type RealtimePresenceEventType = number | number[];