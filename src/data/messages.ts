import type {
  QueryFunctionContext,
  QueryKey,
  InfiniteQueryObserverOptions,
  MutationKey,
  InfiniteData,
} from "@tanstack/query-core";

import { type WeavyContext } from "../client/weavy-context";
import { MessageType, MutateMessageProps, type MessagesResultType } from "../types/messages.types";
import { addCacheItem } from "../utils/query-cache";

export function getMessagesOptions(
  weavyContext: WeavyContext,
  appId: number | null,
  options: any = {}
): InfiniteQueryObserverOptions<MessagesResultType, Error, InfiniteData<MessagesResultType>> {
  const PAGE_SIZE = 25;

  // TODO: Define this truly as reverse
  return {
    ...options,
    initialPageParam: 0,
    queryKey: ["messages", appId],
    queryFn: async (opt: QueryFunctionContext<QueryKey, number>) => {
      const skip = opt.pageParam;
      const url = "/api/apps/" + appId + "/messages?orderby=createdat+desc&skip=" + skip + "&top=" + PAGE_SIZE;

      const response = await weavyContext.get(url);
      const result = await response.json();
      result.data = result.data?.reverse() || [];
      return result;
    },
    getNextPageParam: (lastPage: any, pages: any) => {
      if (lastPage?.end < lastPage?.count) {
        return pages.length * PAGE_SIZE;
      }
      return undefined;
    },
    select: (data: any) => ({
      // reverse scroll
      pages: [...data.pages].reverse(),
      pageParams: [...data.pageParams].reverse(),
    }),
  };
}

export function getAddMessageMutationOptions(weavyContext: WeavyContext, mutationKey: MutationKey) {
  const queryClient = weavyContext.queryClient;

  const options = {
    mutationFn: async (variables: MutateMessageProps) => {
      const response = await weavyContext.post(
        "/api/apps/" + variables.appId + "/messages",
        "POST",
        JSON.stringify({
          text: variables.text,
          blobs: variables.blobs,
          embed_id: variables.embed || null,
          meeting_id: variables.meetingId,
        })
      );
      return response.json();
    },
    mutationKey: mutationKey,
    onMutate: async (variables: any) => {
      await queryClient.cancelQueries({ queryKey: ["messages", variables.appId] });

      const tempId = Math.random();
      const tempData: MessageType = {
        id: tempId,
        app_id: -1,
        attachment_ids: [],
        is_trashed: false,
        text: variables.text,
        html: variables.text,
        plain: variables.text,
        temp: true,
        created_by_id: variables.userId,
        created_by: { id: variables.userId, avatar_url: "", display_name: "", presence: undefined, name: "" },
        created_at: new Date().toUTCString(),
        attachments: [],
        attachment_count: 0,
        reactions: [],
      };
      addCacheItem(queryClient, ["messages", variables.appId], tempData);
      return { tempId };
    },
    onSuccess: (data: MessageType, variables: any, context: any) => {
      addCacheItem(queryClient, ["messages", variables.appId], data, context.tempId);
    },
  };

  return options;
}
