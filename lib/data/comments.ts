import type {
  InfiniteQueryObserverOptions,
  MutationKey,
  InfiniteData,
} from "@tanstack/query-core";

import { type WeavyType } from "../client/weavy";
import { addCacheItem, getCacheItem, getPendingCacheItem, updateCacheItem } from "../utils/query-cache";
import { PostType } from "../types/posts.types";
import { PollOptionType } from "../types/polls.types";
import { CommentType, CommentsResultType, MutateCommentProps } from "../types/comments.types";
import { EntityTypeString } from "../types/app.types";

export function getCommentsOptions(
  weavy: WeavyType,
  type: "posts" | "files" | "apps",
  parentId: number | null,
  options: object = {}
): InfiniteQueryObserverOptions<CommentsResultType, Error, InfiniteData<CommentsResultType>> {
  return {
    ...options,
    initialPageParam: 0,
    queryKey: [type, parentId, "comments"],
    queryFn: async (opt) => {
      const skip = opt.pageParam as number;
      const url = "/api/" + type + "/" + parentId + "/comments?order_by=id&skip=" + skip;

      const response = await weavy.fetch(url);
      const result = await response.json() as CommentsResultType;
      result.data = result.data || [];

      return result;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.end && lastPage.end < lastPage.count) {
        return lastPage.end;
      }
      return undefined;
    },
  };
}

export function getUpdateCommentMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const options = {
    mutationFn: async (variables: MutateCommentProps) => {
      const response = await weavy.fetch("/api/comments/" + variables.id, {
        method: "PATCH",
        body: JSON.stringify({
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
        }),
      });
      return await response.json() as CommentType;
    },
    mutationKey: mutationKey,
    onSuccess: (data: CommentType, variables: MutateCommentProps) => {
      if (variables.id) {

        updateCacheItem(weavy.queryClient, [variables.type, variables.parentId, "comments"], variables.id, (item: CommentType) => {
          item.text = data.text;
          item.html = data.html;
          item.attachments = data.attachments;
          item.meeting = data.meeting;
          item.updated_at = data.updated_at;
          item.updated_by = data.updated_by;
          item.options = data.options;
          item.embed = data.embed;
        });
      }
    },
  };

  return options;
}

export function getAddCommentMutationOptions(weavy: WeavyType) {
  const queryClient = weavy.queryClient;

  const options = {
    mutationFn: async (variables: MutateCommentProps) => {
      const response = await weavy.fetch("/api/" + variables.type + "/" + variables.parentId + "/comments", {
        method: "POST",
        body: JSON.stringify({
          text: variables.text,
          blobs: variables.blobs,
          meeting_id: variables.meetingId,
          options: variables.pollOptions
            .filter((o: PollOptionType) => o.text.trim() !== "")
            .map((o: PollOptionType) => {
              return { text: o.text };
            }),
          embed_id: variables.embedId,
        }),
      });
      return await response.json() as CommentType;
    },
    onMutate: async (variables: MutateCommentProps) => {
      
      const queryKey = [variables.type, variables.parentId, "comments"];

      await queryClient.cancelQueries({ queryKey: queryKey });
      const newest = getPendingCacheItem<CommentType>(weavy.queryClient, queryKey, false);

      if (variables.user) {
        const tempData: CommentType = {
          id: newest ? newest.id - 1 : -1,
          app: variables.type === "apps" ? { id: variables.parentId } : { id: -1 },
          is_trashed: false,
          text: variables.text,
          html: variables.text,
          plain: variables.text,
          created_by: variables.user,
          created_at: new Date().toUTCString(),
          attachments: { count: 0 },
          reactions: { count: 0 },
          is_subscribed: false,
          is_starred: false,
        };

        if (variables.type === "files") {
          tempData.parent = { type: EntityTypeString.File, id: variables.parentId };
        } else if (variables.type === "posts") {
          tempData.parent = { type: EntityTypeString.Post, id: variables.parentId };
        }

        addCacheItem(queryClient, queryKey, tempData, { descending: false });
      }
    },
    onSuccess: (data: CommentType, variables: MutateCommentProps) => {
      const queryKey = [variables.type, data.parent?.id ?? data.app.id, "comments"];

      // check if comment already added
      const existing = getCacheItem<CommentType>(weavy.queryClient, queryKey, data.id);

      if (!existing) {
        // get oldest pending comment
        const pending = getPendingCacheItem<CommentType>(weavy.queryClient, queryKey, true);

        if (pending) {
          // we found a pending comment - replace it with new data
          updateCacheItem(weavy.queryClient, queryKey, pending.id, (item: CommentType) => {
            // REVIEW: Ändra updateCacheItem så man kan sätta ett "helt" objekt?
            item.id = data.id;
            item.app = data.app;
            item.text = data.text;
            item.html = data.html;
            item.embed = data.embed;
            item.meeting = data.meeting;
            item.attachments = data.attachments;
            item.options = data.options;
            item.created_at = data.created_at;
            item.created_by = data.created_by;
            item.updated_at = data.updated_at;
            item.updated_by = data.updated_by;
          });
        } else {
          // add to cache
          // REVIEW: behövs { descending: false }?
          // addCacheItem(queryClient, ["comments", variables.parentId], data, { descending: false });
          addCacheItem(weavy.queryClient, queryKey, data);
        }

        // update cache with number of comments
        if (data.parent?.type === EntityTypeString.Post) {
          updateCacheItem(queryClient, ["posts", data.app.id], data.parent.id, (item: PostType) => {
            if (item.comments) {
              item.comments.count += 1;
            } else {
              item.comments = { count: 1 };
            }
          });
        }
      }
    },
  };

  return options;
}
