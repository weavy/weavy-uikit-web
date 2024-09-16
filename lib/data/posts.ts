import type { InfiniteQueryObserverOptions, MutationKey, InfiniteData } from "@tanstack/query-core";

import { type WeavyType } from "../client/weavy";
import { addCacheItem, updateCacheItem } from "../utils/query-cache";
import { MutatePostProps, PostType, PostsResultType } from "../types/posts.types";
import { PollOptionType } from "../types/polls.types";

export function getPostsOptions(
  weavy: WeavyType,
  appId: number | null
): InfiniteQueryObserverOptions<PostsResultType, Error, InfiniteData<PostsResultType>> {
  const PAGE_SIZE = 25;
  return {
    initialPageParam: 0,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["posts", appId],
    queryFn: async (opt) => {
      const skip = opt.pageParam;
      const url = "/api/apps/" + appId + "/posts?orderby=id+desc&skip=" + skip + "&take=" + PAGE_SIZE;

      const response = await weavy.get(url);
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

export function getUpdatePostMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const options = {
    mutationFn: async (variables: MutatePostProps) => {
      const response = await weavy.post(
        "/api/posts/" + variables.id!,
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
    onMutate: async (variables: MutatePostProps) => {
      updateCacheItem(weavy.queryClient, ["posts", variables.appId], variables.id!, (item: PostType) => {
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
export type MutatePostContextType = { tempId: number };

export function getAddPostMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const queryClient = weavy.queryClient;

  const options = {
    mutationFn: async (variables: MutatePostProps) => {
      const response = await weavy.post(
        "/api/apps/" + variables.appId + "/posts",
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
    onMutate: async (variables: MutatePostProps) => {
      await queryClient.cancelQueries({ queryKey: ["posts", variables.appId] });

      const tempId = Math.random();

      if (variables.user) {
        const tempData: PostType = {
          id: tempId,
          app: { id: -1 },
          is_subscribed: true,
          is_trashed: false,
          text: variables.text,
          html: variables.text,
          plain: variables.text,
          temp: true,
          created_by: variables.user,
          created_at: new Date().toUTCString(),
          attachments: { count: 0 },
          reactions: { count: 0 },
          is_starred: false,
          comments: { count: 0 }
        };
        addCacheItem(queryClient, ["posts", variables.appId], tempData, undefined, { descending: true });
      }
      return { tempId } as MutatePostContextType;
    },
    onSuccess: (data: PostType, variables: MutatePostProps, context?: MutatePostContextType) => {
      addCacheItem(queryClient, ["posts", variables.appId], data, context?.tempId, { descending: true });
    },
  };

  return options;
}
