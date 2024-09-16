import type {
  QueryFunctionContext,
  QueryKey,
  InfiniteQueryObserverOptions,
  MutationKey,
  InfiniteData,
} from "@tanstack/query-core";

import { type WeavyType } from "../client/weavy";
import { addCacheItem, updateCacheItem } from "../utils/query-cache";
import { PostType } from "../types/posts.types";
import { PollOptionType } from "../types/polls.types";
import {
  CommentMutationContextType,
  CommentType,
  CommentsResultType,
  MutateCommentProps,
} from "../types/comments.types";

export function getCommentsOptions(
  weavy: WeavyType,
  type: string,
  parentId: number | null,
  options: object = {}
): InfiniteQueryObserverOptions<CommentsResultType, Error, InfiniteData<CommentsResultType>> {
  const PAGE_SIZE = 25;
  return {
    ...options,
    initialPageParam: 0,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["comments", parentId],
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const skip = opt.pageParam;
      const url = "/api/" + type + "/" + parentId + "/comments?orderby=id&skip=" + skip + "&take=" + PAGE_SIZE;

      const response = await weavy.get(url);
      const result = await response.json();
      result.data = result.data || [];

      return result;
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.end && lastPage?.end < lastPage?.count) {
        return pages.length * PAGE_SIZE;
      }
      return undefined;
    },
  };
}

export function getUpdateCommentMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const options = {
    mutationFn: async (variables: MutateCommentProps) => {
      const response = await weavy.post(
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
          embed_id: variables.embedId || null,
        })
      );
      return response.json();
    },
    mutationKey: mutationKey,
    onSuccess: (data: CommentType, variables: MutateCommentProps) => {
      if (variables.id) {
        updateCacheItem(
          weavy.queryClient,
          ["comments", variables.parentId],
          variables.id,
          (item: CommentType) => {
            item.text = data.text;
            item.html = data.html;
            item.attachments = data.attachments;
            item.meeting = data.meeting;
            item.updated_at = data.updated_at;
            item.updated_by = data.updated_by;
            item.options = data.options;
            item.embed = data.embed;
          }
        );
      }
    },
  };

  return options;
}

export function getAddCommentMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const queryClient = weavy.queryClient;

  const options = {
    mutationFn: async (variables: MutateCommentProps) => {
      const response = await weavy.post(
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
          embed_id: variables.embedId,
        })
      );
      return response.json();
    },
    mutationKey: mutationKey,
    onMutate: async (variables: MutateCommentProps) => {
      await queryClient.cancelQueries({ queryKey: ["comments", variables.parentId] });
      const tempId = Math.random();

      if (variables.user) {
        const tempData: CommentType = {
          id: tempId,
          app: { id: -1 },
          is_trashed: false,
          text: variables.text,
          html: variables.text,
          plain: variables.text,
          temp: true,
          created_by: variables.user,
          created_at: new Date().toUTCString(),
          attachments: { count: 0 },
          reactions: { count: 0 },
          is_subscribed: false,
          is_starred: false,
        };
        addCacheItem(queryClient, ["comments", variables.parentId], tempData, undefined, { descending: false });
      }

      return { tempId } as CommentMutationContextType;
    },
    onSuccess: (data: CommentType, variables: MutateCommentProps, context: CommentMutationContextType) => {
      addCacheItem(queryClient, ["comments", variables.parentId], data, context.tempId, { descending: false });

      updateCacheItem(queryClient, [variables.type, variables.appId], variables.parentId, (item: PostType) => {
        if (item.comments) {
          item.comments.count += 1;
        } else {
          item.comments = { count: 1 };
        }
      });
    },
  };

  return options;
}
