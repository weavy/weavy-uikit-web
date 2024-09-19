import { MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import { updateCacheItem } from "../utils/query-cache";
import { MessageType } from "../types/messages.types";
import { ReactableType } from "../types/reactions.types";
import { MemberType } from "../types/members.types";

/// POST to add a reaction to a message
export function addReactionMutation(
  weavy: WeavyType,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  reaction: string,
  user: MemberType
) {
  return new MutationObserver(weavy.queryClient, {
    mutationFn: async () => {
      const response = await weavy.fetch(`/api/${type}/${entityId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ content: reaction }),
      });
      return response;
    },
    onMutate: () => {
      updateCacheItem(weavy.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, reaction, user, "add");
      });
    },
    onSuccess: () => {
      updateCacheItem(weavy.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, reaction, user, "add");
      });
    },
  });
}

/// DELETE to remove a reaction from a message
export function removeReactionMutation(
  weavy: WeavyType,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  user: MemberType
) {
  return new MutationObserver(weavy.queryClient, {
    mutationFn: async () => {
      const response = await weavy.fetch(`/api/${type}/${entityId}/reactions`, {
        method: "DELETE",
        body: JSON.stringify({}),
      });
      return response;
    },
    onMutate: () => {
      updateCacheItem(weavy.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, "", user, "remove");
      });
    },
    onSuccess: () => {
      updateCacheItem(weavy.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, "", user, "remove");
      });
    },
  });
}

/// DELETE to remove a reaction from a message
export function replaceReactionMutation(
  weavy: WeavyType,
  appId: number | null,
  entityId: number | null,
  type: "messages" | "posts" | "comments",
  reaction: string,
  user: MemberType
) {
  return new MutationObserver(weavy.queryClient, {
    mutationFn: async () => {
      await weavy.fetch(`/api/${type}/${entityId}/reactions`, { method: "DELETE", body: JSON.stringify({}) });

      const addResponse = await weavy.fetch(`/api/${type}/${entityId}/reactions`, {
        method: "POST",
        body: JSON.stringify({ content: reaction }),
      });
      return addResponse;
    },
    onMutate: () => {
      updateCacheItem(weavy.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, reaction, user, "replace");
      });
    },
    onSuccess: () => {
      updateCacheItem(weavy.queryClient, [type, appId], entityId!, (item: MessageType) => {
        updateReaction(item, reaction, user, "replace");
      });
    },
  });
}

export function getReactionListOptions(weavy: WeavyType, type: string, entityId: number) {
  return {
    queryKey: ["reactions", type, entityId],
    enabled: false,
    queryFn: async () => {
      const response = await weavy.fetch("/api/" + type + "/" + entityId + "/reactions");
      return await response.json();
    },
  };
}

type Action = "add" | "replace" | "remove";

function updateReaction(item: MessageType, reactionContent: string, user: MemberType, action: Action): MessageType {
  if ((action === "remove" || action === "replace") && !item.reactions?.data) {
    return item;
  }

  if (!item.reactions) {
    item.reactions = { count: 0, data: [] };
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
