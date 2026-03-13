import { AccessType } from "./app.types";
import { PresenceType } from "./presence.types";
import { QueryResultType } from "./query.types";
import { UserOrAgentMinimalType } from "./users.types";

export type MemberType = UserOrAgentMinimalType & {
  presence?: PresenceType;
  comment?: string;
};

export type MemberDetailType = MemberType & {
  access?: AccessType;
  marked_id?: number;
  marked_at?: string;
};

export type MembersResultType = QueryResultType<MemberDetailType>;

export type MemberIdType = string | number;