import { MemberType } from "./members.types";
import { QueryResultType } from "./query.types";
//import { MessageType } from "./messages.types";

export type ReactableType = {
  content: string;
  created_by?: MemberType;
};

// export type ReactionType = {
//   id: number;
//   parent: MessageType;
//   content: string;
//   created_by: MemberType;
//   count?: number;
// };

export type ReactionsResultType = QueryResultType<ReactableType>;
