import { MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import { ConversationType } from "../types/app.types";
import { ConversationMutationContextType } from "../types/conversations.types";
import { updateCacheItem } from "../utils/query-cache";

export type MutateDeliveredConversationVariables = {
  id: number | null;
};

export type MutateMarkConversationVariables = {
  id: number | null;
  markAsRead: boolean;
  messageId: number | null;
};

export type MutateStarConversationVariables = {
  id: number | null;
  star: boolean;
};

export type MutatePinConversationVariables = {
  id: number | null;
  pin: boolean;
};

export type MutateLeaveConversationVariables = {
  id: number | null;
  members: number[];
};

export type MutateAddMembersToConversationVariables = {
  id: number | null;
  members: number[];
};

export type MutateUpdateConversationVariables = {
  id: number | null;
  title: string | null;
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

export function getDeliveredConversationMutationOptions(weavyContext: WeavyContext) {
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

export function getMarkConversationMutationOptions(weavyContext: WeavyContext) {
  const options = {
    mutationFn: async ({ id, markAsRead, messageId }: MutateMarkConversationVariables) => {
      const url = markAsRead ? `/api/conversations/${id}/mark?messageId=${messageId}` : `/api/conversations/${id}/mark`;
      const response = await weavyContext.post(url, markAsRead ? "PUT" : "DELETE", "");
      return response.json();
    },
    onMutate: async (/*variables: MutateMarkConversationVariables*/) => {
      // updateCacheItem(weavyContext.queryClient, ["conversations"], variables.id!, (item: ConversationType) => {
      //   item.is_unread = !variables.markAsRead;
      // });
      
      // if(variables.messageId){
      //   updateCacheItem(weavyContext.queryClient, ["conversations", variables.id!], -1, (item: ConversationType) => {
      //     if(item.last_message){
      //       item.last_message.id = variables.messageId!;
      //     }          
      //   });
      // }
      
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getStarConversationMutationOptions(weavyContext: WeavyContext) {
  const options = {
    mutationFn: async ({ id, star }: MutateStarConversationVariables) => {
      await weavyContext.post(`/api/apps/${id}/stars`, star ? "POST" : "DELETE", "");
    },
    onMutate: async (variables: MutateStarConversationVariables) => {
      updateCacheItem(weavyContext.queryClient, ["conversations"], variables.id!, (item: ConversationType) => {
        item.is_starred = variables.star;
      });
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getPinConversationMutationOptions(weavyContext: WeavyContext) {
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

export function getLeaveConversationMutationOptions(weavyContext: WeavyContext) {
  const options = {
    mutationFn: async ({ id, members }: MutateLeaveConversationVariables) => {
      await weavyContext.post(`/api/apps/${id}/members/${members.join(",")}`, "DELETE", "");
    },
    onMutate: async () => {
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getAddMembersToConversationMutationOptions(weavyContext: WeavyContext) {
  const options = {
    mutationFn: async ({ id, members }: MutateAddMembersToConversationVariables) => {
      await weavyContext.post(`/api/apps/${id}/members`, "POST", JSON.stringify(members));
    },
    onMutate: async () => {
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getUpdateConversationMutationOptions(weavyContext: WeavyContext) {
  const options = {
    mutationFn: async ({ id, title }: MutateUpdateConversationVariables) => {
      const response = await weavyContext.post(
        `/api/apps/${id}`,
        "PATCH",
        JSON.stringify({
          type: "ChatRoom",
          name: title,
        })
      );
      return response.json();
    },
    onMutate: async (variables: MutateUpdateConversationVariables) => {
      updateCacheItem(weavyContext.queryClient, ["conversations"], variables.id!, (item: ConversationType) => {
        item.display_name = variables.title!;
      });

      updateCacheItem(weavyContext.queryClient, ["conversations", variables.id!], -1, (item: ConversationType) => {
        item.display_name = variables.title!;
      });
      return <ConversationMutationContextType>{};
    },
  };

  return options;
}

export function getDeliveredConversationMutation(weavyContext: WeavyContext): DeliveredConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getDeliveredConversationMutationOptions(weavyContext));
}

export function getMarkConversationMutation(weavyContext: WeavyContext): MarkConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getMarkConversationMutationOptions(weavyContext));
}

export function getStarConversationMutation(weavyContext: WeavyContext): StarConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getStarConversationMutationOptions(weavyContext));
}

export function getPinConversationMutation(weavyContext: WeavyContext): PinConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getPinConversationMutationOptions(weavyContext));
}

export function getLeaveConversationMutation(weavyContext: WeavyContext): LeaveConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getLeaveConversationMutationOptions(weavyContext));
}

export function getAddMembersToConversationMutation(
  weavyContext: WeavyContext
): AddMembersToConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getAddMembersToConversationMutationOptions(weavyContext));
}

export function getUpdateConversationMutation(weavyContext: WeavyContext): UpdateConversationMutationType {
  return new MutationObserver(weavyContext.queryClient, getUpdateConversationMutationOptions(weavyContext));
}
