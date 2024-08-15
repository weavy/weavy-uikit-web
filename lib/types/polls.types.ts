import { MsgType } from "./msg.types";
import { QueryResultType } from "./query.types";
import { UsersResultType } from "./users.types";

export type PollMutationContextType = object;

export type PollType = MsgType & {}

export type PollOptionType = {
  id: number | null;
  text: string;
  has_voted?: boolean;
  votes?: UsersResultType;
};

export type PollOptionsResultType = QueryResultType<PollOptionType>;