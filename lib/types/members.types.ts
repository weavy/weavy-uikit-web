import { AccessTypes } from "./app.types";
import { PresenceType } from "./presence.types";
import { QueryResultType } from "./query.types";
import { UserType } from "./users.types";

export type MemberType = UserType & {
  access?: AccessTypes;
  delivered_at?: string;
  read_at?: string;
  marked_id?: number;
  marked_at?: string;
  presence?: PresenceType;
};

export type MembersResultType = QueryResultType<MemberType>;