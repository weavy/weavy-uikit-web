import { MetadataType, TagsType } from "./lists.types";
import { MembersResultType } from "./members.types";
import { MsgType } from "./msg.types";
import { InfiniteQueryResultType } from "./query.types";
//import { UserType } from "./users.types";

export enum AppTypeGuid {
  Chat = "d65dd4bc-418e-403c-9f56-f9cf4da931ed",
  Comments = "88f96a08-c6c1-4eac-a0bd-5bf8fba1a3fd",
  Files = "523edd88-4bbf-4547-b60f-2859a6d2ddc1",
  Posts = "5ebfa152-de85-48da-82dd-30a1b560c313",
  ChatRoom = "edb400ac-839b-45a7-b2a8-6a01820d1c44",
  PrivateChat = "7e14f418-8f15-46f4-b182-f619b671e470",
  AgentChat = "2352a1c6-abc6-420e-8b85-ca7d5aed8779",
}

export enum AppTypeString {
  Chat = "chat",
  Comments = "comments",
  Files = "files",
  Posts = "posts",
  ChatRoom = "chat_room",
  PrivateChat = "private_chat",
  AgentChat = "agent_chat",
}

export enum AppTypeGuidMapping {
  "d65dd4bc-418e-403c-9f56-f9cf4da931ed" = "chat",
  "88f96a08-c6c1-4eac-a0bd-5bf8fba1a3fd" = "comments",
  "523edd88-4bbf-4547-b60f-2859a6d2ddc1" = "files",
  "5ebfa152-de85-48da-82dd-30a1b560c313" = "posts",
  "edb400ac-839b-45a7-b2a8-6a01820d1c44" = "chat_room",
  "7e14f418-8f15-46f4-b182-f619b671e470" = "private_chat",
  "2352a1c6-abc6-420e-8b85-ca7d5aed8779" = "agent_chat",
}

export enum AppTypeStringMapping {
  "chat" = "d65dd4bc-418e-403c-9f56-f9cf4da931ed",
  "comments" = "88f96a08-c6c1-4eac-a0bd-5bf8fba1a3fd",
  "files" = "523edd88-4bbf-4547-b60f-2859a6d2ddc1",
  "posts" = "5ebfa152-de85-48da-82dd-30a1b560c313",
  "chat_room" = "edb400ac-839b-45a7-b2a8-6a01820d1c44",
  "private_chat" = "7e14f418-8f15-46f4-b182-f619b671e470",
  "agent_chat" = "2352a1c6-abc6-420e-8b85-ca7d5aed8779",
}

export enum AgentAppTypeGuidMapping {
  "2352a1c6-abc6-420e-8b85-ca7d5aed8779" = "agent_chat",
}

export enum AgentAppTypeStringMapping {
  "agent_chat" = "2352a1c6-abc6-420e-8b85-ca7d5aed8779",
}

export enum ComponentType {
  /** Unknown componentType will enable optional uid. */
  Unknown = "unknown"
}

export type AppType = {
  id: number;
  rev: number;
  type: AppTypeGuid;
  access: AccessType;
  permissions: PermissionType[];
  uid?: string;
  name: string;
  description: string;
  archive_url: string;
  avatar_url: string;
  metadata?: MetadataType;
  tags?: TagsType;
  created_at: string;
  updated_at?: string;
  members: MembersResultType;
  is_starred: boolean;
  is_subscribed: boolean;
  is_trashed: boolean;
  last_message: MsgType;
  is_unread: boolean;
  is_pinned: boolean;
};

export type AppRef = {
  /** The id of the app. */
  id: number;
  /** Any uid defined for the app. */
  uid?: string;
  /** Any app type guid defined for the app. */
  type?: AppType["type"];
};

export type AppUpProperties = {
  access?: AccessType;
  directory?: string;
  name?: string;
  description?: string;
  metadata?: MetadataType;
  picture?: string;
  tags?: TagsType;
};

export type AppInProperties = AppUpProperties & {
  type: AppTypeGuid;
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

export enum EntityTypeString {
  App = "app",
  File = "file",
  Message = "message",
  User = "user",
  Comment = "comment",
  Post = "post",
}

export type EntityType = {
  /** The id of the entity */ 
  id: number;
  /** The readable type of the entity */
  type: EntityTypeString;
  /** Any app where the entity belongs. */
  app?: AppRef;
  /** Any parent entity where the entity is attached. */
  parent?: EntityType;
};

export type LinkType = EntityType & {
  /** Any agent used for the entity */ 
  agent?: string;
};

export type AppsResultType = InfiniteQueryResultType<AppType>;

export type MetadataSourceType = {
  source_name?: string;
  source_url?: string;
  source_data?: string;
}

export type AppWithSourceMetadataType = AppType & {
  metadata?: AppType["metadata"] & MetadataSourceType
}