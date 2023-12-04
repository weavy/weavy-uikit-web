import { MemberType } from "./members.types";
import { MessageType } from "./messages.types";

export type ReactableType = {
  content: string;
  created_by_id: number;
};

export type ReactionType = {
  id: number;
  parent: MessageType;
  content: string;
  created_by: MemberType;
  count?: number;
};

export type ReactionsResult = {
  data: ReactionType[];
  start: number;
  end: number;
  count: number;
};
