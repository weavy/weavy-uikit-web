import { ConversationTypeGuid } from "./conversations.types";
import { MembersResultType } from "./members.types";
import { UserType } from "./users.types";

export type AppType = {
  id: number;
  type: AppTypeGuid | ConversationTypeGuid;
  access: AccessType,
  permissions: PermissionType[],
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

export enum AccessType {
  None = "none",
  Read = "read",
  Write = "write",
  Admin = "admin",
} 

export enum PermissionType {
  List = "list",
  Read = "read",
  Create = "create",  
  Update = "update",
  Delete = "delete",
  Admin = "admin",
}

export enum AppTypes {
  Chat = "chat",
  Comments = "comments",
  Files = "files",
  Posts = "posts",
}

export enum AppTypeGuid {
  Chat = "d65dd4bc-418e-403c-9f56-f9cf4da931ed",
  Comments = "88f96a08-c6c1-4eac-a0bd-5bf8fba1a3fd",
  Files = "523edd88-4bbf-4547-b60f-2859a6d2ddc1",
  Posts = "5ebfa152-de85-48da-82dd-30a1b560c313",
}


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