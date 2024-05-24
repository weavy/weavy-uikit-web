import { PollOptionType } from "./polls.types";

import { MsgType } from "./msg.types";
import { UserType } from "./users.types";
import { EntityType } from "./app.types";
import { InfiniteQueryResultType } from "./query.types";

export type CommentsResultType = InfiniteQueryResultType<CommentType>;

export type MutateCommentProps = {
  id?: number;
  appId?: number;
  parentId: number;
  type: "posts" | "files" | "apps";
  text: string;
  blobs?: number[];
  attachments?: number[];
  meetingId?: number;
  pollOptions: PollOptionType[];
  embedId: number;
  user?: UserType;
};

export type CommentMutationContextType = { 
  tempId?: number 
};

export type CommentType = MsgType & {
  parent?: EntityType,
  temp?: boolean
};
