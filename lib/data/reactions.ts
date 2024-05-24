import { MutationObserver } from "@tanstack/query-core";
import { type WeavyContextType } from "../client/weavy";
import { updateCacheItem } from "../utils/query-cache";
import { MessageType } from "../types/messages.types";
import { ReactableType } from "../types/reactions.types";
import { MemberType } from "../types/members.types";

/// POST to add a reaction to a message
export function addReactionMutation(
  weavyContext: WeavyContextType,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  reaction: string,
  user: MemberType
) {
  return new MutationObserver(weavyContext.queryClient, {
    mutationFn: async () => {
      const response = await weavyContext.post(
        `/api/${type}/${entityId}/reactions`,
        "POST",
        JSON.stringify({ content: reaction })
      );
      return response;
    },
    onMutate: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, reaction, user, "add");
      });
    },
    onSuccess: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, reaction, user, "add");
      });
    },
  });
}

/// DELETE to remove a reaction from a message
export function removeReactionMutation(
  weavyContext: WeavyContextType,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  user: MemberType
) {
  return new MutationObserver(weavyContext.queryClient, {
    mutationFn: async () => {
      const response = await weavyContext.post(`/api/${type}/${entityId}/reactions`, "DELETE", JSON.stringify({}));
      return response;
    },
    onMutate: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, "", user, "remove");              
      });
    },
    onSuccess: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, "", user, "remove");              
      });
    },
  });
}

/// DELETE to remove a reaction from a message
export function replaceReactionMutation(
  weavyContext: WeavyContextType,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  reaction: string,
  user: MemberType
) {
  return new MutationObserver(weavyContext.queryClient, {
    mutationFn: async () => {
      await weavyContext.post(`/api/${type}/${entityId}/reactions`, "DELETE", JSON.stringify({}));

      const addResponse = await weavyContext.post(
        `/api/${type}/${entityId}/reactions`,
        "POST",
        JSON.stringify({ content: reaction })
      );
      return addResponse;
    },
    onMutate: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, reaction, user, "replace");        
      });
    },
    onSuccess: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, reaction, user, "replace");        
      });
    },
  });
}

export function getReactionListOptions(weavyContext: WeavyContextType, type: string, entityId: number) {
  return {
    queryKey: ["reactions", type, entityId],
    enabled: false,
    queryFn: async () => {
      const response = await weavyContext.get("/api/" + type + "/" + entityId + "/reactions");
      return await response.json();
    },
  };
}

type Action = "add" | "replace" | "remove";

function updateReaction(item: MessageType, reactionContent: string, user: MemberType, action: Action) : MessageType {
  if ((action === "remove" || action === "replace") && !item.reactions?.data) {
    return item;
  }

  if (!item.reactions) {
    item.reactions = { count: 0, data: []};
  }

  if (!item.reactions.data) {
    item.reactions.data = [];
  }

  if (action === "add") {
    item.reactions.data = [
      ...item.reactions.data.filter((r: ReactableType) => r.created_by?.id !== user.id),
      { content: reactionContent, created_by: user },
    ];
  } else if (action === "replace") {
    item.reactions.data = [
      ...item.reactions.data.filter((r: ReactableType) => r.created_by?.id !== user.id),
      { content: reactionContent, created_by: user },
    ];
  } else if (action === "remove") {
    if (item.reactions.data) {
      item.reactions.data = [...item.reactions.data.filter((r: ReactableType) => r.created_by?.id !== user.id)];
    }
  }

  return item;

}