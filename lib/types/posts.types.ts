import { CommentType } from "./comments.types";
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
  appId: number;
  user: UserType;
  text: string;
  blobs?: number[];
  attachments?: number[];
  meetingId?: number;
  pollOptions: PollOptionType[];
  embed: number;
};

export type PostMutationContextType = {};

export type PostType = MsgType & {
  comment_count?: number;
  comments?: CommentType[];
  is_subscribed: boolean;
  temp?: boolean;
};