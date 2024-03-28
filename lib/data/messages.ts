import type {
  QueryFunctionContext,
  QueryKey,
  InfiniteQueryObserverOptions,
  MutationKey,
  InfiniteData,
} from "@tanstack/query-core";

import { type WeavyContextType } from "../client/weavy-context";
import { MessageType, MutateMessageProps, type MessagesResultType, MessageMutationContextType } from "../types/messages.types";
import { addCacheItem } from "../utils/query-cache";
import { PollOptionType } from "../types/polls.types";

export function getMessagesOptions(
  weavyContext: WeavyContextType,
  appId: number | null,
  options: Object = {}
): InfiniteQueryObserverOptions<MessagesResultType, Error, InfiniteData<MessagesResultType>> {
  const PAGE_SIZE = 25;

  // TODO: Define this truly as reverse
  return {
    ...options,
    initialPageParam: 0,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["messages", appId],
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const skip = opt.pageParam;
      const url = "/api/apps/" + appId + "/messages?orderby=createdat+desc&skip=" + skip + "&top=" + PAGE_SIZE;

      const response = await weavyContext.get(url);
      const result = await response.json() as MessagesResultType;
      result.data = result.data?.reverse() || [];
      return result;
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage?.end < lastPage?.count) {
        return pages.length * PAGE_SIZE;
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

export function getAddMessageMutationOptions(weavyContext: WeavyContextType, mutationKey: MutationKey) {
  const queryClient = weavyContext.queryClient;

  const options = {
    mutationFn: async (variables: MutateMessageProps) => {
      const response = await weavyContext.post(
        "/api/apps/" + variables.app_id + "/messages",
        "POST",
        JSON.stringify({
          text: variables.text,
          blobs: variables.blobs,
          embed_id: variables.embed_id || null,
          meeting_id: variables.meeting_id,
          options: variables.poll_options
            .filter((o: PollOptionType) => o.text.trim() !== "")
            .map((o: PollOptionType) => {
              return { text: o.text };
            }),
          metadata: {
            temp_id: variables.temp_id?.toString(),
          }
        })
      );
      return response.json();
    },
    mutationKey: mutationKey,
    onMutate: async (variables: MutateMessageProps) => {
      await queryClient.cancelQueries({ queryKey: ["messages", variables.app_id] });

      if (variables.temp_id) {
        const tempData: MessageType = {
          id: variables.temp_id,
          app_id: -1,
          attachment_ids: [],
          is_trashed: false,
          text: variables.text,
          html: variables.text,
          plain: variables.text,
          temp: true,
          created_by_id: variables.user_id,
          created_by: { id: variables.user_id, avatar_url: "", display_name: "", presence: undefined, name: "" },
          created_at: new Date().toUTCString(),
          attachments: [],
          attachment_count: 0,
          reactions: [],
        };
        addCacheItem(queryClient, ["messages", variables.app_id], tempData);
      }
      return { temp_id: variables.temp_id } as MessageMutationContextType;
    },
    onSuccess: (data: MessageType, variables: MutateMessageProps, context: MessageMutationContextType) => {
      addCacheItem(queryClient, ["messages", variables.app_id], data, context.temp_id);
    },
  };

  return options;
}
