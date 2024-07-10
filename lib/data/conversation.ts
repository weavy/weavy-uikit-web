import { InfiniteData, MutationObserver } from "@tanstack/query-core";
import { type WeavyContextType } from "../client/weavy";
import { ConversationType, ConversationTypeGuid, ConversationsResultType } from "../types/conversations.types";
import { ConversationMutationContextType } from "../types/conversations.types";
import { removeCacheItem, updateCacheItem, updateCacheItems } from "../utils/query-cache";
import { AccessTypes, AppRef, AppType } from "../types/app.types";
import { getApi, getApiOptions } from "./api";

export type MutateDeliveredConversationVariables = {
  id: number;
};

export type MutateMarkConversationVariables = {
  id: number;
  markAsRead: boolean;
  messageId: number | null;
};

export type MutateStarConversationVariables = {
  id: number;
  star: boolean;
};

export type MutatePinConversationVariables = {
  id: number;
  pin: boolean;
};

export type MutateLeaveConversationVariables = {
  id: number;
  members: number[];
};

export type MutateUpdateMemberVariables = {
  id: number;
  userId: number;
  access: AccessTypes;
};

export type MutateAddMembersToConversationVariables = {
  id: number;
  members: number[];
};

export type MutateUpdateConversationVariables = {
  id: number;
  name?: string | null | undefined;
  blobId?: number | null | undefined;
  thumbnailUrl?: string | null | undefined;
};

export type MutateTrashConversationVariables = {
  id: number;
};

export type DeliveredConversationMutationType = MutationObserver<
  void,
  Error,
  MutateDeliveredConversationVariables,
  ConversationMutationContextType
>;
export type MarkConversationMutationType = MutationObserver<
  void,
  Error,
  MutateMarkConversationVariables,
  ConversationMutationContextType
>;
export type StarConversationMutationType = MutationObserver<
  void,
  Error,
  MutateStarConversationVariables,
  ConversationMutationContextType
>;
export type PinConversationMutationType = MutationObserver<
  void,
  Error,
  MutatePinConversationVariables,
  ConversationMutationContextType
>;
export type LeaveConversationMutationType = MutationObserver<
  void,
  Error,
  MutateLeaveConversationVariables,
  ConversationMutationContextType
>;
export type UpdateMemberMutationType = MutationObserver<
  void,
  Error,
  MutateUpdateMemberVariables,
  ConversationMutationContextType
>;
export type AddMembersToConversationMutationType = MutationObserver<
  void,
  Error,
  MutateAddMembersToConversationVariables,
  ConversationMutationContextType
>;
export type UpdateConversationMutationType = MutationObserver<
  ConversationType,
  Error,
  MutateUpdateConversationVariables,
  ConversationMutationContextType
>;
export type TrashConversationMutationType = MutationObserver<
  void,
  Error,
  MutateTrashConversationVariables,
  ConversationMutationContextType
>;
export function getDeliveredConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id }: MutateDeliveredConversationVariables) => {
      const url = `/api/conversations/${id}/delivered`;
      await weavyContext.post(url, "PUT", "");
    },
    onMutate: async () => {
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getMarkConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, markAsRead, messageId }: MutateMarkConversationVariables) => {
      const url = markAsRead ? `/api/conversations/${id}/mark?messageId=${messageId}` : `/api/conversations/${id}/mark`;
      await weavyContext.post(url, markAsRead ? "PUT" : "DELETE", "");
    },
    onMutate: async (variables: MutateMarkConversationVariables) => {
      updateCacheItems(
        weavyContext.queryClient,
        { queryKey: ["conversations", "list"], exact: false },
        variables.id,
        (item: ConversationType) => {
          item.is_unread = !variables.markAsRead;
        }
      );

      updateCacheItem(weavyContext.queryClient, ["conversations", variables.id], -1, (item: ConversationType) => {
        item.is_unread = !variables.markAsRead;
        if (variables.messageId) {
          if (item.last_message) {
            item.last_message.id = variables.messageId!;
          }
        }
      });

      return <ConversationMutationContextType>{};
    },
    onError: (error: Error, variables: MutateMarkConversationVariables) => {
      console.error(error.message);
      updateCacheItems(
        weavyContext.queryClient,
        { queryKey: ["conversations", "list"], exact: false },
        variables.id,
        (item: ConversationType) => {
          item.is_unread = variables.markAsRead;
        }
      );
    },
  };

  return options;
}

export function getStarConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, star }: MutateStarConversationVariables) => {
      await weavyContext.post(`/api/apps/${id}/stars`, star ? "POST" : "DELETE", "");
    },
    onMutate: async (variables: MutateStarConversationVariables) => {
      updateCacheItems(
        weavyContext.queryClient,
        { queryKey: ["conversations", "list"], exact: false },
        variables.id,
        (item: ConversationType) => {
          item.is_starred = variables.star;
        }
      );
      return <ConversationMutationContextType>{};
    },
    onError: (error: Error, variables: MutateStarConversationVariables) => {
      console.error(error.message);
      updateCacheItems(
        weavyContext.queryClient,
        { queryKey: ["conversations", "list"], exact: false },
        variables.id,
        (item: ConversationType) => {
          item.is_starred = !variables.star;
        }
      );
    },
  };

  return options;
}

export function getPinConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, pin }: MutatePinConversationVariables) => {
      await weavyContext.post(`/api/conversations/${id}/pin`, pin ? "PUT" : "DELETE", "");
    },
    onMutate: async (variables: MutatePinConversationVariables) => {
      updateCacheItems(
        weavyContext.queryClient,
        { queryKey: ["conversations", "list"], exact: false },
        variables.id,
        (item: ConversationType) => {
          item.is_pinned = variables.pin;
        }
      );
      return <ConversationMutationContextType>{};
    },
    onSettled: async () => {
      await weavyContext.queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  };

  return options;
}

export function getLeaveConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, members }: MutateLeaveConversationVariables) => {
      await weavyContext.post(`/api/apps/${id}/members/${members.join(",")}`, "DELETE", "");
    },
    onMutate: async (variables: MutateLeaveConversationVariables) => {
      removeCacheItem(weavyContext.queryClient, ["conversations"], variables.id);
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getUpdateMemberMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, userId, access }: MutateUpdateMemberVariables) => {
      await weavyContext.post(`/api/apps/${id}/members/${userId}`, "PUT", JSON.stringify({ access }));
    },
    onMutate: async (variables: MutateUpdateMemberVariables) => {
      removeCacheItem(weavyContext.queryClient, ["conversations"], variables.id);
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getAddMembersToConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, members }: MutateAddMembersToConversationVariables) => {
      await weavyContext.post(
        `/api/apps/${id}/members`,
        "PUT",
        JSON.stringify(
          members.map((id: number) => {
            return { id: id, access: "write" };
          })
        )
      );
    },
    onMutate: async () => {
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getUpdateConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, name, blobId }: MutateUpdateConversationVariables) => {
      const response = await weavyContext.post(
        `/api/apps/${id}`,
        "PATCH",
        JSON.stringify({
          name: name,
          Picture: blobId,
        })
      );
      return response.json();
    },
    onMutate: async (variables: MutateUpdateConversationVariables) => {
      updateCacheItem(weavyContext.queryClient, ["conversations"], variables.id, (item: ConversationType) => {
        item.display_name = variables.name!;
        if (typeof variables?.thumbnailUrl !== "undefined") {
          item.avatar_url = variables.thumbnailUrl!;
        }
      });

      updateCacheItem(weavyContext.queryClient, ["conversations", variables.id], -1, (item: ConversationType) => {
        item.display_name = variables.name!;
        if (typeof variables?.thumbnailUrl !== "undefined") {
          item.avatar_url = variables.thumbnailUrl!;
        }
      });
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getTrashConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id }: MutateTrashConversationVariables) => {
      await weavyContext.post(`/api/apps/${id}/trash`, "POST", "");
    },
    onMutate: async (variables: MutateTrashConversationVariables) => {
      removeCacheItem(weavyContext.queryClient, ["conversations"], variables.id);

      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getDeliveredConversationMutation(weavyContext: WeavyContextType): DeliveredConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getDeliveredConversationMutationOptions(weavyContext));
}

export function getMarkConversationMutation(weavyContext: WeavyContextType): MarkConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getMarkConversationMutationOptions(weavyContext));
}

export function getStarConversationMutation(weavyContext: WeavyContextType): StarConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getStarConversationMutationOptions(weavyContext));
}

export function getPinConversationMutation(weavyContext: WeavyContextType): PinConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getPinConversationMutationOptions(weavyContext));
}

export function getLeaveConversationMutation(weavyContext: WeavyContextType): LeaveConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getLeaveConversationMutationOptions(weavyContext));
}

export function getUpdateMemberMutation(weavyContext: WeavyContextType): UpdateMemberMutationType {
  return new MutationObserver(weavyContext.queryClient, getUpdateMemberMutationOptions(weavyContext));
}

export function getAddMembersToConversationMutation(
  weavyContext: WeavyContextType
): AddMembersToConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getAddMembersToConversationMutationOptions(weavyContext));
}

export function getUpdateConversationMutation(weavyContext: WeavyContextType): UpdateConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getUpdateConversationMutationOptions(weavyContext));
}

export function getTrashConversationMutation(weavyContext: WeavyContextType): TrashConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getTrashConversationMutationOptions(weavyContext));
}

export function getConversationOptions(weavyContext: WeavyContextType, conversationId: number) {
  return getApiOptions<ConversationType>(weavyContext, ["conversations", conversationId], undefined, {
    initialData: () => {
      // Use any data from the conversation-list query as the initial data for the conversation query
      return weavyContext?.queryClient
        .getQueryData<InfiniteData<ConversationsResultType>>(["conversations"])
        ?.pages.flatMap((cPage) => cPage.data)
        .find((c) => c?.id === conversationId);
    },
  });
}

export function getConversation(weavyContext: WeavyContextType, conversationId: number) {
  return getApi<ConversationType>(weavyContext, ["conversations", conversationId], undefined, {
    initialData: () => {
      // Use any data from the conversation-list query as the initial data for the conversation query
      return weavyContext?.queryClient
        .getQueryData<InfiniteData<ConversationsResultType>>(["conversations"])
        ?.pages.flatMap((cPage) => cPage.data)
        .find((c) => c?.id === conversationId);
    },
  });
}

export async function resolveConversation(
  weavyContext: WeavyContextType,
  conversation: AppRef | AppType | number,
  types: ConversationTypeGuid[] = Object.values(ConversationTypeGuid)
): Promise<ConversationType | undefined> {
  let checkConversation: ConversationType;

  if (typeof conversation === "number") {
    checkConversation = await getConversation(weavyContext, conversation);
  } else if (typeof conversation.id === "number" && !conversation.type) {
    checkConversation = await getConversation(weavyContext, conversation.id);
  } else if (typeof conversation.type === "string") {
    checkConversation = conversation as ConversationType;
  } else {
    return undefined;
  }

  return types.includes(checkConversation.type) ? checkConversation : undefined;
}
