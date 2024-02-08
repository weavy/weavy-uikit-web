import { PlainObjectType } from "./generic.types";
import { PresenceType } from "./presence.types";

// TYPES
export type UserType = {
  id: number;
  uid?: string;
  name: string;
  username?: string;
  email?: string;
  display_name: string;
  given_name?: string;
  middle_name?: string;
  family_name?: string;
  nick_name?: string;
  phone_number?: string;
  comment?: string;
  avatar_url?: string;
  presence?: PresenceType;
  directory?: DirectoryType;
  directory_id?: number;
  metadata?: PlainObjectType;
  tags?: string[];
  created_at?: string;
  modified_at?: string
  is_suspended?: boolean;
  is_trashed?: boolean;
};

export type AutocompleteUserType = {
  id: number;
  uid?: string;
  display_name: string;
  avatar_url?: string;
  presence?: PresenceType;
  is_member?: boolean
}

export type UsersAutocompleteResultType = {
  data: AutocompleteUserType[];
  start?: number;
  end?: number;
  count: number;
}

export type DirectoryType = {
  id: number;
  name: string;
  members?: UserType[];
}