import { ConversationType } from "./app.types";

export type ConversationsResultType = {
  data: ConversationType[];
  start: number;
  end: number;
  count: number;
};

export type ConversationMutationContextType = {};
