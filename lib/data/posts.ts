import type {
  InfiniteQueryObserverOptions,
  MutationKey,
  InfiniteData,
} from "@tanstack/query-core";

import { type WeavyContext } from "../client/weavy-context";
import { addCacheItem, updateCacheItem } from "../utils/query-cache";
import { MutatePostProps, PostType, PostsResultType } from "../types/posts.types";
import { PollOptionType } from "../types/polls.types";

export function getPostsOptions(
  weavyContext: WeavyContext,
  appId: number | null
): InfiniteQueryObserverOptions<PostsResultType, Error, InfiniteData<PostsResultType>> {
  const PAGE_SIZE = 25;
  return {
    initialPageParam: 0,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["posts", appId],
    queryFn: async (opt) => {
      const skip = opt.pageParam;
      const url = "/api/apps/" + appId + "/posts?orderby=createdat+desc&skip=" + skip + "&top=" + PAGE_SIZE;

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

export function getUpdatePostMutationOptions(weavyContext: WeavyContext, mutationKey: MutationKey) {
  const options = {
    mutationFn: async (variables: MutatePostProps) => {
      const response = await weavyContext.post(
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
      updateCacheItem(weavyContext.queryClient, ["posts", variables.appId], variables.id!, (item: PostType) => {
        item.text = variables.text;
        item.html = variables.text;
      });
    },
    onSuccess: (data: PostType, variables: MutatePostProps) => {
      if (variables.id) {
        updateCacheItem(weavyContext.queryClient, ["posts", variables.appId], variables.id, (item: PostType) => {
          item.text = data.text;
          item.html = data.html;
          item.attachment_ids = data.attachment_ids;
          item.attachments = data.attachments;
          item.embed = data.embed;
          item.meeting = data.meeting;
          item.meeting_id = data.meeting_id;
          item.modified_at = data.modified_at;
          item.modified_by = data.modified_by;
          item.options = data.options;
        });
      }
    },
  };

  return options;
}
export type MutatePostContextType = { tempId: number };

export function getAddPostMutationOptions(weavyContext: WeavyContext, mutationKey: MutationKey) {
  const queryClient = weavyContext.queryClient;

  const options = {
    mutationFn: async (variables: MutatePostProps) => {
      const response = await weavyContext.post(
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
      const tempData: PostType = {
        id: tempId,
        app_id: -1,
        attachment_ids: [],
        is_subscribed: true,
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
      addCacheItem(queryClient, ["posts", variables.appId], tempData, undefined, { descending: true });
      return { tempId } as MutatePostContextType;
    },
    onSuccess: (data: PostType, variables: MutatePostProps, context?: MutatePostContextType) => {
      addCacheItem(queryClient, ["posts", variables.appId], data, context?.tempId, { descending: true });
    },
  };

  return options;
}
