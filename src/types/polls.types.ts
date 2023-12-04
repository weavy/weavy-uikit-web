import { MsgType } from "./msg.types";

export type PollMutationContextType = {};

export type PollType = MsgType & {}

export type PollOptionType = {
  id: number | null;
  text: string;
  has_voted?: boolean;
  vote_count?: number;
};
