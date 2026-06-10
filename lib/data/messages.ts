import type {
  InfiniteQueryObserverOptions,
  MutationKey,
  InfiniteData
} from "@tanstack/query-core";

import { type WeavyType } from "../client/weavy";
import { MessageType, MutateMessageProps, type MessagesResultType } from "../types/messages.types";
import { PollOptionType } from "../types/polls.types";
import {
  addCacheItem,
  getCacheItem,
  getPendingCacheItem,
  updateCacheItem,
  updateCacheItems,
} from "../utils/query-cache";
import { MemberDetailType } from "../types/members.types";

export function getMessagesOptions(
  weavy: WeavyType,
  appId: number | null,
  options: object = {}
): InfiniteQueryObserverOptions<MessagesResultType, Error, InfiniteData<MessagesResultType>> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    ...options,
    initialPageParam: 0,
    queryKey: ["messages", appId],
    queryFn: async (opt) => {
      const skip = opt.pageParam as number;
      const url = "/api/apps/" + appId + "/messages?order_by=id+desc&skip=" + skip;
      const response = await weavy.fetch(url);
      const result = (await response.json()) as MessagesResultType;
      result.data = result.data?.reverse() || [];
      return result;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage?.end && lastPage?.end < lastPage?.count) {
        return lastPage.end;
      }
      return undefined;
    },
    select: (data) => ({
      // reverse scroll
      pages: [...data.pages].reverse(),
      pageParams: [...data.pageParams].reverse(),
    }),
  };
}

export function getAddMessageMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const options = {
    mutationFn: async (variables: MutateMessageProps) => {
      const response = await weavy.fetch("/api/apps/" + variables.app_id + "/messages", {
        method: "POST",
        body: JSON.stringify({
          text: variables.text,
          blobs: variables.blobs,
          embed_id: variables.embed_id || null,
          meeting_id: variables.meeting_id,
          options: variables.poll_options
            .filter((o: PollOptionType) => o.text.trim() !== "")
            .map((o: PollOptionType) => {
              return { text: o.text };
            }),
          metadata: variables.metadata || null,
          context: variables.context,
        }),
      });
      return (await response.json()) as MessageType;
    },
    mutationKey: mutationKey,
    onMutate: (variables: MutateMessageProps) => {
      const queryKey = ["messages", variables.app_id];

      // TODO: wait for any queries to finish instead of cancelling
      //await weavy.queryClient.cancelQueries({ queryKey: queryKey });
      const newest = getPendingCacheItem<MessageType>(weavy.queryClient, queryKey, false);

      const pending: MessageType = {
        id: newest ? newest.id - 1 : -1,
        app: { id: variables.app_id },
        text: variables.text,
        html: variables.text,
        plain: variables.text,
        created_by: variables.user,
        created_at: new Date().toUTCString(),
        attachments: { count: 0 },
        reactions: { count: 0 },
        is_starred: false,
        is_subscribed: true,
        is_trashed: false,
      };
      addCacheItem(weavy.queryClient, queryKey, pending);
    },
    onSuccess: (data: MessageType) => {
      // update members and set marked_id for current user
      updateCacheItems<MemberDetailType>(
        weavy.queryClient,
        { queryKey: ["members", data.app.id] },
        data.created_by.id,
        (item) => ({
          ...item,
          marked_id: data.id,
          marked_at: data.created_at,
        })
      );

      const queryKey = ["messages", data.app.id];
      const { queryClient } = weavy;

      // try to find existing or pending message
      const existing = getCacheItem<MessageType>(queryClient, queryKey, data.id);
      const pending = existing ? null : getPendingCacheItem<MessageType>(queryClient, queryKey, true);

      // update existing or pending message if found
      if (existing) {
        updateCacheItem<MessageType>(queryClient, queryKey, existing.id, () => data);
      } else if (pending) {
        updateCacheItem<MessageType>(queryClient, queryKey, pending.id, () => data);
      } else {
        // add message if not found
        addCacheItem(queryClient, queryKey, data);
      }
    },
  };
  return options;
}
