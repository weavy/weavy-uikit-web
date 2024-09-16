import { InfiniteData, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
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
export function getDeliveredConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id }: MutateDeliveredConversationVariables) => {
      const url = `/api/conversations/${id}/delivered`;
      await weavy.post(url, "PUT", "");
    },
    onMutate: async () => {
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getMarkConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id, markAsRead, messageId }: MutateMarkConversationVariables) => {
      const url = markAsRead ? `/api/conversations/${id}/mark?messageId=${messageId}` : `/api/conversations/${id}/mark`;
      await weavy.post(url, markAsRead ? "PUT" : "DELETE", "");
    },
    onMutate: async (variables: MutateMarkConversationVariables) => {
      updateCacheItems(
        weavy.queryClient,
        { queryKey: ["conversations", "list"], exact: false },
        variables.id,
        (item: ConversationType) => {
          item.is_unread = !variables.markAsRead;
        }
      );

      updateCacheItem(weavy.queryClient, ["conversations", variables.id], -1, (item: ConversationType) => {
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
        weavy.queryClient,
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

export function getStarConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id, star }: MutateStarConversationVariables) => {
      await weavy.post(`/api/apps/${id}/stars`, star ? "POST" : "DELETE", "");
    },
    onMutate: async (variables: MutateStarConversationVariables) => {
      updateCacheItems(
        weavy.queryClient,
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
        weavy.queryClient,
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

export function getPinConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id, pin }: MutatePinConversationVariables) => {
      await weavy.post(`/api/conversations/${id}/pin`, pin ? "PUT" : "DELETE", "");
    },
    onMutate: async (variables: MutatePinConversationVariables) => {
      updateCacheItems(
        weavy.queryClient,
        { queryKey: ["conversations", "list"], exact: false },
        variables.id,
        (item: ConversationType) => {
          item.is_pinned = variables.pin;
        }
      );
      return <ConversationMutationContextType>{};
    },
    onSettled: async () => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
  };

  return options;
}

export function getLeaveConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id, members }: MutateLeaveConversationVariables) => {
      await weavy.post(`/api/apps/${id}/members/${members.join(",")}`, "DELETE", "");
    },
    onMutate: async (variables: MutateLeaveConversationVariables) => {
      removeCacheItem(weavy.queryClient, ["conversations"], variables.id);
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getUpdateMemberMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id, userId, access }: MutateUpdateMemberVariables) => {
      await weavy.post(`/api/apps/${id}/members/${userId}`, "PUT", JSON.stringify({ access }));
    },
    onMutate: async (variables: MutateUpdateMemberVariables) => {
      removeCacheItem(weavy.queryClient, ["conversations"], variables.id);
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getAddMembersToConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id, members }: MutateAddMembersToConversationVariables) => {
      await weavy.post(
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

export function getUpdateConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id, name, blobId }: MutateUpdateConversationVariables) => {
      const response = await weavy.post(
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
      updateCacheItem(weavy.queryClient, ["conversations"], variables.id, (item: ConversationType) => {
        item.display_name = variables.name!;
        if (typeof variables?.thumbnailUrl !== "undefined") {
          item.avatar_url = variables.thumbnailUrl!;
        }
      });

      updateCacheItem(weavy.queryClient, ["conversations", variables.id], -1, (item: ConversationType) => {
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

export function getTrashConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ id }: MutateTrashConversationVariables) => {
      await weavy.post(`/api/apps/${id}/trash`, "POST", "");
    },
    onMutate: async (variables: MutateTrashConversationVariables) => {
      removeCacheItem(weavy.queryClient, ["conversations"], variables.id);

      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getDeliveredConversationMutation(weavy: WeavyType): DeliveredConversationMutationType {
  return new MutationObserver(weavy.queryClient, getDeliveredConversationMutationOptions(weavy));
}

export function getMarkConversationMutation(weavy: WeavyType): MarkConversationMutationType {
  return new MutationObserver(weavy.queryClient, getMarkConversationMutationOptions(weavy));
}

export function getStarConversationMutation(weavy: WeavyType): StarConversationMutationType {
  return new MutationObserver(weavy.queryClient, getStarConversationMutationOptions(weavy));
}

export function getPinConversationMutation(weavy: WeavyType): PinConversationMutationType {
  return new MutationObserver(weavy.queryClient, getPinConversationMutationOptions(weavy));
}

export function getLeaveConversationMutation(weavy: WeavyType): LeaveConversationMutationType {
  return new MutationObserver(weavy.queryClient, getLeaveConversationMutationOptions(weavy));
}

export function getUpdateMemberMutation(weavy: WeavyType): UpdateMemberMutationType {
  return new MutationObserver(weavy.queryClient, getUpdateMemberMutationOptions(weavy));
}

export function getAddMembersToConversationMutation(
  weavy: WeavyType
): AddMembersToConversationMutationType {
  return new MutationObserver(weavy.queryClient, getAddMembersToConversationMutationOptions(weavy));
}

export function getUpdateConversationMutation(weavy: WeavyType): UpdateConversationMutationType {
  return new MutationObserver(weavy.queryClient, getUpdateConversationMutationOptions(weavy));
}

export function getTrashConversationMutation(weavy: WeavyType): TrashConversationMutationType {
  return new MutationObserver(weavy.queryClient, getTrashConversationMutationOptions(weavy));
}

export function getConversationOptions(weavy: WeavyType, conversationId: number) {
  return getApiOptions<ConversationType>(weavy, ["conversations", conversationId], undefined, {
    initialData: () => {
      // Use any data from the conversation-list query as the initial data for the conversation query
      return weavy?.queryClient
        .getQueryData<InfiniteData<ConversationsResultType>>(["conversations"])
        ?.pages.flatMap((cPage) => cPage.data)
        .find((c) => c?.id === conversationId);
    },
  });
}

export function getConversation(weavy: WeavyType, conversationId: number) {
  return getApi<ConversationType>(weavy, ["conversations", conversationId], undefined, {
    initialData: () => {
      // Use any data from the conversation-list query as the initial data for the conversation query
      return weavy?.queryClient
        .getQueryData<InfiniteData<ConversationsResultType>>(["conversations"])
        ?.pages.flatMap((cPage) => cPage.data)
        .find((c) => c?.id === conversationId);
    },
  });
}

export async function resolveConversation(
  weavy: WeavyType,
  conversation: AppRef | AppType | number,
  types: ConversationTypeGuid[] = Object.values(ConversationTypeGuid)
): Promise<ConversationType | undefined> {
  let checkConversation: ConversationType;

  if (typeof conversation === "number") {
    checkConversation = await getConversation(weavy, conversation);
  } else if (typeof conversation.id === "number" && !conversation.type) {
    checkConversation = await getConversation(weavy, conversation.id);
  } else if (typeof conversation.type === "string") {
    checkConversation = conversation as ConversationType;
  } else {
    return undefined;
  }

  return types.includes(checkConversation.type) ? checkConversation : undefined;
}
