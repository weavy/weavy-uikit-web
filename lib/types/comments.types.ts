import { PollOptionType } from "./polls.types";
import { UserType } from "./users.types";

import { MsgType } from "./msg.types";

export type CommentsResultType = {
  data: CommentType[];
  start: number;
  end: number;
  count: number;
};

export type MutateCommentProps = {
  id?: number;
  appId?: number;
  parentId: number;
  type: "posts" | "files" | "apps";
  user: UserType;
  text: string;
  blobs?: number[];
  attachments?: number[];
  meetingId?: number;
  pollOptions: PollOptionType[];
  embed: number;
};

export type CommentMutationContextType = { 
  tempId?: number 
};

export type CommentType = MsgType & {
  temp?: boolean;
};
