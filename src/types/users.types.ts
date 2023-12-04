import { PresenceType } from "./presence.types";

// TYPES
export type UserType = {
  id: number;
  uid?: string;
  name: string;
  username?: string;
  email?: string;
  display_name: string;
  avatar_url?: string;
  presence?: PresenceType;
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