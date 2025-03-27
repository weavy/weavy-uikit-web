import { MetadataType } from "./lists.types";
import { MsgType } from "./msg.types";
import { PollOptionType } from "./polls.types";
import { InfiniteQueryResultType } from "./query.types";
import { UserType } from "./users.types";

export type MessagesResultType = InfiniteQueryResultType<MessageType>;

export type MutateMessageProps = {
  app_id: number;
  user: UserType;
  text: string;
  blobs?: number[];
  meeting_id?: number;
  poll_options: PollOptionType[];
  embed_id: number;
  metadata?: MetadataType;
  context_id?: number
};

export type MessageType = MsgType;
