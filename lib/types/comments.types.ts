import { PollOptionType } from "./polls.types";

import { MsgType } from "./msg.types";
import { UserType } from "./users.types";
import { InfiniteQueryResultType } from "./query.types";

export type CommentsResultType = InfiniteQueryResultType<CommentType>;

export type MutateCommentProps = {
  id?: number;
  app_id?: number;
  parent_id: number;
  type: "posts" | "files" | "apps";
  text: string;
  blobs?: number[];
  attachments?: number[];
  meeting_id?: number;
  poll_options: PollOptionType[];
  embed_id: number;
  context?: number[];
  user?: UserType;
};

export type CommentType = MsgType;
