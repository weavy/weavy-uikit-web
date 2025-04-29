import type { InfiniteQueryObserverOptions, MutationKey, InfiniteData } from "@tanstack/query-core";

import { type WeavyType } from "../client/weavy";
import { addCacheItem, getPendingCacheItem, getCacheItem, updateCacheItem } from "../utils/query-cache";
import { MutatePostProps, PostType, PostsResultType } from "../types/posts.types";
import { PollOptionType } from "../types/polls.types";

export function getPostsOptions(
  weavy: WeavyType,
  appId: number | null
): InfiniteQueryObserverOptions<PostsResultType, Error, InfiniteData<PostsResultType>> {
  return {
    initialPageParam: 0,
    queryKey: ["posts", appId],
    queryFn: async (opt) => {
      const skip = opt.pageParam as number;
      const url = "/api/apps/" + appId + "/posts?order_by=id+desc&skip=" + skip;

      const response = await weavy.fetch(url);
      const result = await response.json() as PostsResultType;
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

export function getUpdatePostMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const options = {
    mutationFn: async (variables: MutatePostProps) => {
      const response = await weavy.fetch("/api/posts/" + variables.id, {
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
          embed_id: variables.embed || null,
        }),
      });
      return await response.json() as PostType;
    },
    mutationKey: mutationKey,
    onMutate: (variables: MutatePostProps) => {
      updateCacheItem(weavy.queryClient, ["posts", variables.appId], variables.id, (item: PostType) => {
        item.text = variables.text;
        item.html = variables.text;
      });
    },
    onSuccess: (data: PostType, variables: MutatePostProps) => {
      if (variables.id) {
        updateCacheItem(weavy.queryClient, ["posts", variables.appId], variables.id, (item: PostType) => {
          item.text = data.text;
          item.html = data.html;
          item.attachments = data.attachments;
          item.embed = data.embed;
          item.meeting = data.meeting;
          item.updated_at = data.updated_at;
          item.updated_by = data.updated_by;
          item.options = data.options;
        });
      }
    },
  };

  return options;
}

export function getAddPostMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const queryClient = weavy.queryClient;

  const options = {
    mutationFn: async (variables: MutatePostProps) => {
      const response = await weavy.fetch("/api/apps/" + variables.appId + "/posts", {
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
          embed_id: variables.embed,
        }),
      });
      return await response.json() as PostType;
    },
    mutationKey: mutationKey,
    onMutate: async (variables: MutatePostProps) => {
      const queryKey = ["posts", variables.appId];

      await queryClient.cancelQueries({ queryKey: queryKey });
      const newest = getPendingCacheItem<PostType>(weavy.queryClient, queryKey, false);

      if (variables.user) {
        const tempData: PostType = {
          id: newest ? newest.id - 1 : -1,
          app: { id: variables.appId },
          is_subscribed: true,
          is_trashed: false,
          text: variables.text,
          html: variables.text,
          plain: variables.text,
          created_by: variables.user,
          created_at: new Date().toUTCString(),
          attachments: { count: 0 },
          reactions: { count: 0 },
          is_starred: false,
          comments: { count: 0 },
        };
        addCacheItem(queryClient, ["posts", variables.appId], tempData, { descending: true });
      }
    },
    onSuccess: (data: PostType) => {

      const queryKey = ["posts", data.app.id];

      // check if post already added
      const existing = getCacheItem<PostType>(weavy.queryClient, queryKey, data.id);

      if (!existing) {
        // get oldest pending post
        const pending = getPendingCacheItem<PostType>(weavy.queryClient, queryKey, true);
        
        if (pending) {
          // we found a pending message - replace it with new data
          updateCacheItem(weavy.queryClient, queryKey, pending.id, (item: PostType) => {
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
          //addCacheItem(queryClient, ["posts", variables.appId], data, { descending: true });
          addCacheItem(weavy.queryClient, queryKey, data);
        }
      }

    },
  };

  return options;
}
