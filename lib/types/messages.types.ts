import { MsgType } from "./msg.types";
import { PollOptionType } from "./polls.types";
import { InfiniteQueryResultType } from "./query.types";

export type MessagesResultType = InfiniteQueryResultType<MessageType>;

export type MutateMessageProps = {
  app_id: number;
  user_id: number;
  text: string;
  blobs?: number[];
  meeting_id?: number;
  poll_options: PollOptionType[];
  embed_id: number;
  temp_id?: number;
};

export type MessageMutationContextType = {
  temp_id?: number;
};

export type MessageType = MsgType & {
  temp: boolean;
};