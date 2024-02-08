import { AccessType } from "./app.types";
import { PresenceType } from "./presence.types";
import { UserType } from "./users.types";

export type MemberType = UserType & {
  access?: AccessType;
  delivered_at?: string;
  read_at?: string;
  marked_id?: number;
  marked_at?: string;
  presence?: PresenceType;
};

export type MembersResultType = {
  data: MemberType[];
  start?: number;
  end?: number;
  count: number;
};