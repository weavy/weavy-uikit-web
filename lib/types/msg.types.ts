import { AppRef } from "./app.types";
import { EmbedType } from "./embeds.types";
import { FilesResultType } from "./files.types";
import { MeetingType } from "./meetings.types";
import { MemberType } from "./members.types";
import { PollOptionsResultType } from "./polls.types";
import { ReactionsResultType } from "./reactions.types";

/* Base type for Comment, Message, Post etc */
export type MsgType = {
  id: number;
  app: AppRef;
  text: string;
  html: string;
  plain: string;
  created_at: string;
  created_by: MemberType;
  updated_at?: string;
  updated_by?: MemberType;
  attachments?: FilesResultType;
  embed?: EmbedType;
  meeting?: MeetingType;
  reactions: ReactionsResultType;
  is_trashed: boolean;
  is_subscribed: boolean;
  is_starred: boolean;
  options?: PollOptionsResultType;
  metadata?: MetadataType;
  tags?: string[];
};

export type MetadataType = {
  [Key: string]: string;
};
