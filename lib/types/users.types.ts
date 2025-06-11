import { BlobType } from "./files.types";
import { MetadataType } from "./lists.types";
import { PresenceType } from "./presence.types";
import { QueryResultType } from "./query.types";

// TYPES
export type UserType = {
  id: number;
  uid?: string;
  name: string;
  given_name?: string;
  middle_name?: string;
  family_name?: string;
  nickname?: string;
  email?: string;
  phone_number?: string;
  avatar_url?: string;
  picture?: BlobType;
  directory?: DirectoryType;
  presence?: PresenceType;
  comment?: string;
  metadata?: MetadataType;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  is_trashed?: boolean;
};

export type UsersResultType = QueryResultType<UserType>;

export type AgentType = UserType & {
  provider: string;
  model: string;
  instructions: string;
  knowledge: number[];
  is_agent: true;
};

export type UserOrAgentType = UserType & Partial<AgentType>

export type TypingUserType = UserType & { time: number };

export type DirectoryType = {
  id: number;
  name: string;
  members: UsersResultType
}