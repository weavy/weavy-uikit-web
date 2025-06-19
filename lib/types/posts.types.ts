import { CommentsResultType } from "./comments.types";
import { MsgType } from "./msg.types";
import { PollOptionType } from "./polls.types";
import { UserType } from "./users.types";

export type PostsResultType = {
  data: PostType[];
  start: number;
  end: number;
  count: number;
};

export type MutatePostProps = {
  id?: number;
  app_id: number;
  user?: UserType;
  text: string;
  blobs?: number[];
  attachments?: number[];
  meeting_id?: number;
  poll_options: PollOptionType[];
  embed_id?: number;
  context?: number[];
};

export type PostType = MsgType & {
  comments: CommentsResultType;
};