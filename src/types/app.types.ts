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

export type ConversationType = AppType & {
  id: number;
  created_by_id: number;
  display_name: string;
  last_message: MessageType;
  is_unread: boolean;
  is_pinned: boolean;
  is_starred: boolean;
  type: string;
  avatar_url: string;
};

export type EntityType = {
  id: number;
  type: "app" | "file" | "message" | "user" | "comment" | "post";
};

export enum EntityTypes {
  App = "app",
  File = "file",
  Message = "message",
  User = "user",
  Comment = "comment",
  Post = "post",
}
