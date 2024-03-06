import { MsgType } from "./msg.types";
import { PollOptionType } from "./polls.types";

export type MessagesResultType = {
  data: MessageType[];
  start: number;
  end: number;
  count: number;
};

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