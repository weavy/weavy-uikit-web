import { MetadataType } from "./lists.types";
import { PresenceType } from "./presence.types";
import { QueryResultType } from "./query.types";

// TYPES
export type UserType = {
  id: number;
  uid?: string;
  name: string;
  avatar_url?: string;
  presence?: PresenceType;
  metadata?: MetadataType;
  tags?: string[];
  created_at?: string;
  updated_at?: string;
  is_bot?: boolean;
  is_trashed?: boolean;  
};

export type UsersResultType = QueryResultType<UserType>;

export type BotType = UserType & {
  provider: string;
  model: string;
  instructions: string;
  is_bot: true;
};

export type TypingUserType = UserType & { time: number };