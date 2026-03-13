import { CommentsResultType } from "./comments.types";
import { MsgType } from "./msg.types";
import { PollOptionType } from "./polls.types";
import { QueryFilterProps, QueryFilterType } from "./query.types";
import { UserType } from "./users.types";
import { isPlainObject } from "../utils/objects";

export type PostsResultType = {
  data: PostType[];
  start: number;
  end: number;
  count: number;
};

export type MutatePostProps = {
  id?: number;
  app_id: number;
  user: UserType;
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

export type PostQueryOrderType = `id ${"desc" | "asc"}`;

export type PostQueryFilterType = Omit<QueryFilterType, "order_by"> & {
  app?: Array<string | number>;
  following?: boolean;
  order_by?: PostQueryOrderType;
};

export interface PostQueryFilterProps extends QueryFilterProps {
  following: boolean | undefined;
  orderBy?: PostQueryOrderType | null | undefined;
}

export type MutatePostTempData = {
  tempPost: PostType;
}

export function isPostQueryFilter(filter: unknown) {
    if (isPlainObject(filter) && (
      typeof filter.following === "string"
    )) {
      return true;
    } else {
      return false;
    }
}