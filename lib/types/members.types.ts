import { AccessType } from "./app.types";
import { PresenceType } from "./presence.types";
import { QueryResultType } from "./query.types";
import { UserOrAgentType } from "./users.types";

export type MemberType = UserOrAgentType & {
  access?: AccessType;
  delivered_at?: string;
  read_at?: string;
  marked_id?: number;
  marked_at?: string;
  presence?: PresenceType;
};

export type MembersResultType = QueryResultType<MemberType>;

export type MemberIdType = string | number;