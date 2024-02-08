import { MsgType } from "./msg.types";

export type MessagesResultType = {
  data: MessageType[];
  start: number;
  end: number;
  count: number;
};

export type MutateMessageProps = {
  appId: number;
  userId: number;
  text: string;
  blobs?: number[];
  meetingId?: number;
  embed: number;
};

export type MessageMutationContextType = {
  tempId?: number;
};

export type MessageType = MsgType & {
  temp: boolean;
};