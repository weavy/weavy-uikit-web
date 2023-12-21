import { MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import { updateCacheItem } from "../utils/query-cache";
import { MessageType } from "../types/messages.types";
import { ReactableType } from "../types/reactions.types";

/// POST to add a reaction to a message
export function addReactionMutation(
  weavyContext: WeavyContext,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  reaction: string,
  userId: number
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
        item.reactions = item.reactions || [];
        item.reactions = [...item.reactions, { content: reaction, created_by_id: userId }];
      });
    },
    onSuccess: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        item.reactions = item.reactions.map((r: ReactableType) => {
          if (r.created_by_id !== userId) {
            return r;
          }
          // replace reaction
          r.content = reaction;
          return r;
        });
      });
    },
  });
}

/// DELETE to remove a reaction from a message
export function removeReactionMutation(
  weavyContext: WeavyContext,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  userId: number
) {
  return new MutationObserver(weavyContext.queryClient, {
    mutationFn: async () => {
      const response = await weavyContext.post(`/api/${type}/${entityId}/reactions`, "DELETE", JSON.stringify({}));
      return response;
    },
    onMutate: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        item.reactions = [...item.reactions.filter((r: ReactableType) => r.created_by_id !== userId)];
      });
    },
    onSuccess: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        item.reactions = [...item.reactions.filter((r: ReactableType) => r.created_by_id !== userId)];
      });
    },
  });
}

/// DELETE to remove a reaction from a message
export function replaceReactionMutation(
  weavyContext: WeavyContext,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  reaction: string,
  userId: number
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
        item.reactions = item.reactions.map((r: ReactableType) => {
          if (r.created_by_id !== userId) {
            return r;
          }
          // replace reaction
          r.content = reaction;
          return r;
        });
      });
    },
    onSuccess: () => {
      updateCacheItem(weavyContext.queryClient, [type, appId], entityId!, (item: MessageType) => {
        item.reactions = item.reactions.map((r: ReactableType) => {
          if (r.created_by_id !== userId) {
            return r;
          }
          // replace reaction
          r.content = reaction;
          return r;
        });
      });
    },
  });
}

export function getReactionListOptions(weavyContext: WeavyContext, type: string, entityId: number) {
  return {
    queryKey: ["reactions", type, entityId],
    enabled: false,
    queryFn: async () => {
      const response = await weavyContext.get("/api/" + type + "/" + entityId + "/reactions");
      return await response.json();
    },
  };
}
