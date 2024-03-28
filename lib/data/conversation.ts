import { MutationObserver } from "@tanstack/query-core";
import { type WeavyContextType } from "../client/weavy-context";
import { ConversationType } from "../types/conversations.types";
import { ConversationMutationContextType } from "../types/conversations.types";
import { removeCacheItem, updateCacheItem } from "../utils/query-cache";

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

export type MutateAddMembersToConversationVariables = {
  id: number;
  members: number[];
};

export type MutateUpdateConversationVariables = {
  id: number;
  name: string | null;
};

export type MutateTrashConversationVariables = {
  id: number;
};

export type DeliveredConversationMutationType = MutationObserver<
  ConversationType,
  Error,
  MutateDeliveredConversationVariables,
  ConversationMutationContextType
>;
export type MarkConversationMutationType = MutationObserver<
  ConversationType,
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
      const response = await weavyContext.post(url, "PUT", "");
      return response.json();
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
      const response = await weavyContext.post(url, markAsRead ? "PUT" : "DELETE", "");
      return await response.json() as ConversationType;
    },
    onMutate: async (variables: MutateMarkConversationVariables) => {
      updateCacheItem(weavyContext.queryClient, ["conversations"], variables.id, (item: ConversationType) => {
        item.is_unread = !variables.markAsRead;
      });

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
    onSuccess: (data: ConversationType, variables: MutateMarkConversationVariables) => {
      updateCacheItem(
        weavyContext.queryClient,
        ["conversations"],
        variables.id,
        (conversation: ConversationType) => Object.assign(conversation, data)
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
      updateCacheItem(weavyContext.queryClient, ["conversations"], variables.id, (item: ConversationType) => {
        item.is_starred = variables.star;
      });
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getPinConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, pin }: MutatePinConversationVariables) => {
      await weavyContext.post(`/api/conversations/${id}/pin`, pin ? "PUT" : "DELETE", "");
    },
    onMutate: async () => {
      return <ConversationMutationContextType>{};
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

export function getAddMembersToConversationMutationOptions(weavyContext: WeavyContextType) {
  const options = {
    mutationFn: async ({ id, members }: MutateAddMembersToConversationVariables) => {
      await weavyContext.post(
        `/api/apps/${id}/members`,
        "POST",
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
    mutationFn: async ({ id, name }: MutateUpdateConversationVariables) => {
      const response = await weavyContext.post(
        `/api/apps/${id}`,
        "PATCH",
        JSON.stringify({
          name: name,
        })
      );
      return response.json();
    },
    onMutate: async (variables: MutateUpdateConversationVariables) => {
      updateCacheItem(weavyContext.queryClient, ["conversations"], variables.id, (item: ConversationType) => {
        item.display_name = variables.name!;
      });

      updateCacheItem(weavyContext.queryClient, ["conversations", variables.id], -1, (item: ConversationType) => {
        item.display_name = variables.name!;
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
