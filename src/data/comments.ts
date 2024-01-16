import type {
  QueryFunctionContext,
  QueryKey,
  InfiniteQueryObserverOptions,
  MutationKey,
  InfiniteData,
} from "@tanstack/query-core";

import { type WeavyContext } from "../client/weavy-context";
import { addCacheItem, updateCacheItem } from "../utils/query-cache";
import { PostType } from "../types/posts.types";
import { PollOptionType } from "../types/polls.types";
import { CommentMutationContextType, CommentType, CommentsResultType, MutateCommentProps } from "../types/comments.types";

export function getCommentsOptions(
  weavyContext: WeavyContext,
  type: string,
  parentId: number | null,
  options: Object = {}
): InfiniteQueryObserverOptions<CommentsResultType, Error, InfiniteData<CommentsResultType>> {
  const PAGE_SIZE = 25;
  return {
    ...options,
    initialPageParam: 0,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["comments", parentId],
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const skip = opt.pageParam;
      const url =
        "/api/" + type + "/" + parentId + "/comments?orderby=createdat+asc&skip=" + skip + "&top=" + PAGE_SIZE;

      const response = await weavyContext.get(url);
      const result = await response.json();
      result.data = result.data || [];

      return result;
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage?.end < lastPage?.count) {
        return pages.length * PAGE_SIZE;
      }
      return undefined;
    },
  };
}

export function getUpdateCommentMutationOptions(weavyContext: WeavyContext, mutationKey: MutationKey) {
  const options = {
    mutationFn: async (variables: MutateCommentProps) => {
      const response = await weavyContext.post(
        "/api/comments/" + variables.id!,
        "PATCH",
        JSON.stringify({
          text: variables.text,
          blobs: variables.blobs,
          attachments: variables.attachments,
          meeting_id: variables.meetingId,
          options: variables.pollOptions
            .filter((o: PollOptionType) => o.text.trim() !== "")
            .map((o: PollOptionType) => {
              return { id: o.id, text: o.text };
            }),
          embed_id: variables.embed || null,
        })
      );
      return response.json();
    },
    mutationKey: mutationKey,
    onSuccess: (data: CommentType, variables: MutateCommentProps) => {
      if (variables.id) {
        updateCacheItem(weavyContext.queryClient, ["comments", variables.parentId], variables.id, (item: CommentType) => {
          item.text = data.text;
          item.html = data.html;
          item.attachment_ids = data.attachment_ids;
          item.attachments = data.attachments;
          item.meeting = data.meeting;
          item.meeting_id = data.meeting_id;
          item.modified_at = data.modified_at;
          item.modified_by = data.modified_by;
          item.options = data.options;
          item.embed = data.embed;
        });
      }
    },
  };

  return options;
}

export function getAddCommentMutationOptions(weavyContext: WeavyContext, mutationKey: MutationKey) {
  const queryClient = weavyContext.queryClient;

  const options = {
    mutationFn: async (variables: MutateCommentProps) => {
      const response = await weavyContext.post(
        "/api/" + variables.type + "/" + variables.parentId + "/comments",
        "POST",
        JSON.stringify({
          text: variables.text,
          blobs: variables.blobs,
          meeting_id: variables.meetingId,
          options: variables.pollOptions
            .filter((o: PollOptionType) => o.text.trim() !== "")
            .map((o: PollOptionType) => {
              return { text: o.text };
            }),
          embed_id: variables.embed,
        })
      );
      return response.json();
    },
    mutationKey: mutationKey,
    onMutate: async (variables: MutateCommentProps) => {
      await queryClient.cancelQueries({ queryKey: ["comments", variables.parentId] });

      const tempId = Math.random();
      const tempData: CommentType = {
        id: tempId,
        app_id: -1,
        attachment_ids: [],
        is_trashed: false,
        text: variables.text,
        html: variables.text,
        plain: variables.text,
        temp: true,
        created_by_id: variables.user.id,
        created_by: {
          id: variables.user.id,
          avatar_url: variables.user.avatar_url,
          display_name: variables.user.display_name,
          presence: undefined,
          name: variables.user.name,
        },
        created_at: new Date().toUTCString(),
        attachments: [],
        reactions: [],
      };
      addCacheItem(queryClient, ["comments", variables.parentId], tempData, undefined, { descending: false });
      return { tempId } as CommentMutationContextType;
    },
    onSuccess: (data: CommentType, variables: MutateCommentProps, context: CommentMutationContextType) => {
      addCacheItem(queryClient, ["comments", variables.parentId], data, context.tempId, { descending: false });

      updateCacheItem(queryClient, [variables.type, variables.appId], variables.parentId, (item: PostType) => {
        item.comment_count = (item.comment_count || 0) + 1;
      });
    },
  };

  return options;
}
