import { BlobType } from "./files.types";
import { MetadataType } from "./lists.types";
import { PresenceType } from "./presence.types";
import { QueryResultType } from "./query.types";

// TYPES

export type DirectoryType = {
  id: number;
  name: string;
  /** Only populated on directory-specific endpoints, not on user summary responses. */
  members?: UsersResultType;
}

// Minimal
export type UserOrAgentMinimalType = {
  id: number;
  uid?: string;
  name: string;
  avatar_url?: string;
  is_agent?: boolean;
}

// Summary

export type UserType = {
  id: number;
  uid?: string;
  name: string;
  avatar_url?: string;
  directories?: DirectoryType[];
  created_at?: string;
  updated_at?: string;
};

export type AgentType = UserType & {
  provider: string;
  model: string;
  comment?: string;
  is_agent: true;
};


// Detailed data

export type UserDetailType = UserType & {
  picture?: BlobType;
  metadata?: MetadataType;
  tags?: string[];
  comment?: string;
  is_trashed?: boolean;

  email?: string;
  given_name?: string;
  middle_name?: string;
  family_name?: string;
  nickname?: string;
  phone_number?: string;
  username?: string;
  presence?: PresenceType;
  is_followed?: boolean;
}

export type AgentDetailType = AgentType & {
  picture?: BlobType;
  metadata?: MetadataType;
  tags?: string[];
  is_trashed?: boolean;

  instructions: string;
  functions: string[];
  knowledge: number[];
  web_search: boolean;
  max_tokens?: number;
  mcp_servers: string[];

  is_followed?: boolean;
}

// Utility types

export type UserOrAgentType = UserType & Omit<Partial<AgentType>, "is_agent"> & {
  is_agent?: boolean;
}
export type UserOrAgentDetailType = UserDetailType & Omit<Partial<AgentDetailType>, "is_agent"> & {
  is_agent?: boolean;
}
export type TypingUserType = UserType & { time: number };
export type UsersResultType = QueryResultType<UserType>;
