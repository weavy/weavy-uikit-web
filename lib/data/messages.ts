import type {
  QueryFunctionContext,
  QueryKey,
  InfiniteQueryObserverOptions,
  MutationKey,
  InfiniteData,
} from "@tanstack/query-core";

import { type WeavyType } from "../client/weavy";
import { MessageType, MutateMessageProps, type MessagesResultType } from "../types/messages.types";
import { PollOptionType } from "../types/polls.types";
import {
  addCacheItem,
  getCacheItem,
  getPendingCacheItem,
  updateCacheItem,
} from "../utils/query-cache";
import { MemberType } from "../types/members.types";

export function getMessagesOptions(
  weavy: WeavyType,
  appId: number | null,
  options: object = {}
): InfiniteQueryObserverOptions<MessagesResultType, Error, InfiniteData<MessagesResultType>> {
  return {
    ...options,
    initialPageParam: 0,
    queryKey: ["messages", appId],
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const skip = opt.pageParam;
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
          context_id: variables.context_id || null
        }),
      });
      return response.json();
    },
    mutationKey: mutationKey,
    onMutate: async (variables: MutateMessageProps) => {
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
      updateCacheItem(
        weavy.queryClient,
        ["members", data.app.id],
        data.created_by.id,
        (item: MemberType) => {
          item.marked_id = data.id;
          item.marked_at = data.created_at;
        }
      );

      const queryKey = ["messages", data.app.id];

      // check if message already added
      const existing = getCacheItem<MessageType>(weavy.queryClient, queryKey, data.id);

      if (!existing) {
        // get oldest pending message
        const pending = getPendingCacheItem<MessageType>(weavy.queryClient, queryKey, true);

        if (pending) {
          // we found a pending message - replace it with new data
          updateCacheItem(weavy.queryClient, queryKey, pending.id, (item: MessageType) => {
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
          addCacheItem(weavy.queryClient, queryKey, data);
        }
      }
    },
  };
  return options;
}
