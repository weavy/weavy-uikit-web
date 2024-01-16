import { MembersResultType } from "./members.types";
import { MessageType } from "./messages.types";
import { UserType } from "./users.types";

export type AppType = {
  id: number;
  type: string;
  uid: string;
  display_name: string;
  name: string;
  description: string;
  archive_url: string;
  avatar_url: string;
  metadata?: { [key: string]: unknown };
  tags?: string[];
  created_at: string;
  created_by_id: number;
  created_by?: UserType;
  modified_at?: string;
  modified_by_id?: number;
  modified_by?: UserType;
  members: MembersResultType;
  is_starred: boolean;
  is_subscribed: boolean;
  is_trashed: boolean;
};

export enum ConversationTypes {
  ChatRoom = "edb400ac-839b-45a7-b2a8-6a01820d1c44",
  ContextualChat = "d65dd4bc-418e-403c-9f56-f9cf4da931ed",
  PrivateChat = "7e14f418-8f15-46f4-b182-f619b671e470",
}

export type ConversationType = AppType & {
  id: number;
  created_by_id: number;
  display_name: string;
  last_message: MessageType;
  is_unread: boolean;
  is_pinned: boolean;
  is_starred: boolean;
  type: ConversationTypes;
  avatar_url: string;
};

export enum EntityTypes {
  App = "app",
  File = "file",
  Message = "message",
  User = "user",
  Comment = "comment",
  Post = "post",
}

export type EntityType = {
  id: number;
  type: EntityTypes;
};

//export type ConversationAppType = typeof ConversationTypes[keyof typeof ConversationTypes]