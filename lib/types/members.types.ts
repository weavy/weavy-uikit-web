import { AccessType } from "./app.types";
import { PresenceType } from "./presence.types";
import { QueryResultType } from "./query.types";
import { UserOrAgentMinimalType } from "./users.types";

export type MemberType = UserOrAgentMinimalType & {
  presence?: PresenceType;
  comment?: string;
  /** Whether the authenticated user has blocked this member. Caller-relative; never indicates the inverse. */
  is_blocked?: boolean;
};

export type MemberDetailType = MemberType & {
  access?: AccessType;
  marked_id?: number;
  marked_at?: string;
};

export type MembersResultType = QueryResultType<MemberDetailType>;

export type MemberIdType = string | number;