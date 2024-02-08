import {
  QueryFunctionContext,
  QueryKey,
  InfiniteQueryObserverOptions,
  InfiniteData,
  MutationObserver,
} from "@tanstack/query-core";

import { type WeavyContext } from "../client/weavy-context";

import { ConversationMutationContextType, ConversationsResultType } from "../types/conversations.types";
import { ConversationType } from "../types/app.types";

export type MutateAddConversationVariables = {
  members: number[];
};

export type AddConversationMutationType = MutationObserver<
  ConversationType,
  Error,
  MutateAddConversationVariables,
  ConversationMutationContextType
>;

export function getConversationsOptions(
  weavyContext: WeavyContext,
  options: Object = {},
  searchText?: () => string | undefined
): InfiniteQueryObserverOptions<ConversationsResultType, Error, InfiniteData<ConversationsResultType>> {
  const PAGE_SIZE = 25;
  return {
    ...options,
    initialPageParam: 0,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["conversations"],
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const query = searchText?.() || '';
      const skip = opt.pageParam;
      const url = `/api/conversations?contextual=false&q=${query}&skip=${skip}&top=${PAGE_SIZE}`;

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

export function getAddConversationMutationOptions(weavyContext: WeavyContext) {
  const options = {
    mutationFn: async ({ members }: MutateAddConversationVariables) => {
      const response = await weavyContext.post(
        `/api/conversations`,
        "POST",
        JSON.stringify({
          members: members,
        })
      );
      return await response.json();
    },
    onMutate: async (_variables: MutateAddConversationVariables) => {
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getAddConversationMutation(weavyContext: WeavyContext): AddConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getAddConversationMutationOptions(weavyContext));
}

// export function getUpdatePostMutationOptions(weavyContext: WeavyContext, mutationKey: MutationKey) {
//     const options = {
//         mutationFn: async (variables: MutatePostProps) => {
//             const response = await weavyContext.post(
//                 '/api/posts/' + variables.id!,
//                 'PATCH',
//                 JSON.stringify({
//                     text: variables.text,
//                     blobs: variables.blobs,
//                     attachments: variables.attachments,
//                     meeting_id: variables.meetingId,
//                     options: variables.pollOptions
//                         .filter((o: PollOptionType) => o.text.trim() !== '')
//                         .map((o: PollOptionType) => {
//                             return { id: o.id, text: o.text }
//                         }),
//                     embed_id: variables.embed || null,
//                 })
//             )
//             return response.json()
//         },
//         mutationKey: mutationKey,
//         onSuccess: (data: PostType, variables: any, context: any) => {
//             updateCacheItem(weavyContext.queryClient, ['posts', variables.appId], variables.id, (item: PostType) => {
//                 item.text = data.text
//                 item.html = data.html
//                 item.attachment_ids = data.attachment_ids
//                 item.attachments = data.attachments
//                 item.embed = data.embed
//                 item.meeting = data.meeting
//                 item.meeting_id = data.meeting_id
//                 item.modified_at = data.modified_at
//                 item.modified_by = data.modified_by
//                 item.options = data.options
//             })
//         },
//     }

//     return options
// }

// export function getAddPostMutationOptions(weavyContext: WeavyContext, mutationKey: MutationKey) {
//     const queryClient = weavyContext.queryClient

//     const options = {
//         mutationFn: async (variables: MutatePostProps) => {
//             const response = await weavyContext.post(
//                 '/api/apps/' + variables.appId + '/posts',
//                 'POST',
//                 JSON.stringify({
//                     text: variables.text,
//                     blobs: variables.blobs,
//                     meeting_id: variables.meetingId,
//                     options: variables.pollOptions
//                         .filter((o: PollOptionType) => o.text.trim() !== '')
//                         .map((o: PollOptionType) => {
//                             return { text: o.text }
//                         }),
//                     embed_id: variables.embed,
//                 })
//             )
//             return response.json()
//         },
//         mutationKey: mutationKey,
//         onMutate: async (variables: MutatePostProps) => {
//             await queryClient.cancelQueries({ queryKey: ['posts', variables.appId] })

//             const tempId = Math.random()
//             const tempData: PostType = {
//                 id: tempId,
//                 app_id: -1,
//                 attachment_ids: [],
//                 is_subscribed: true,
//                 is_trashed: false,
//                 text: variables.text,
//                 html: variables.text,
//                 plain: variables.text,
//                 temp: true,
//                 created_by_id: variables.user.id,
//                 created_by: { id: variables.user.id, avatar_url: variables.user.avatar_url, display_name: variables.user.display_name, presence: '', name: variables.user.name },
//                 created_at: new Date().toUTCString(),
//                 attachments: [],
//                 reactions: [],
//             }
//             addCacheItem(queryClient, ['posts', variables.appId], tempData, undefined, { descending: true })
//             return { tempId }
//         },
//         onSuccess: (data: PostType, variables: any, context: any) => {
//             addCacheItem(queryClient, ['posts', variables.appId], data, context.tempId, { descending: true })
//         },
//     }

//     return options
// }
