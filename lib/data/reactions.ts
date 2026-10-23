import { MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import { updateCacheItems } from "../utils/query-cache";
import { ReactableType, ReactionsResultType } from "../types/reactions.types";
import { MemberType } from "../types/members.types";
import { MsgType } from "../types/msg.types";

export function reactionMutation(
  weavy: WeavyType,
  parentId: number,
  parentType: "posts" | "files" | "apps",
  entityId: number,
  entityType: "messages" | "posts" | "comments",
  content: string | undefined,
  user: MemberType
) {
  return new MutationObserver(weavy.queryClient, {
    mutationFn: async () => {
      return await weavy.fetch(`/api/${entityType}/${entityId}/reactions`, {
        method: content ? "POST": "DELETE",
        body: JSON.stringify({ content: content }),
      });
    },
    onMutate: () => {
      // Comments use keys such as ["apps", "comments", 42, around]; include every paging variant.
      const queryKey = entityType === "comments" ? [parentType, entityType, parentId] : [entityType, parentId];
      updateCacheItems<MsgType>(weavy.queryClient, { queryKey }, entityId, (item) =>
        updateReaction(item, content, user)
      );

      if (parentType === "apps" && entityType === "posts") {
        updateCacheItems<MsgType>(weavy.queryClient, { queryKey: ["posts", "feed"] }, entityId, (item) =>
          updateReaction(item, content, user)
        );
      }
    }
  });
}

export function getReactionListOptions(weavy: WeavyType, entityType: string, entityId: number) {
  return {
    queryKey: [entityType, entityId, "reactions"],
    enabled: false,
    queryFn: async () => {
      const response = await weavy.fetch("/api/" + entityType + "/" + entityId + "/reactions");
      return await response.json() as ReactionsResultType;
    },
  };
}

export function updateReaction(item: MsgType, content: string | undefined, user: MemberType): MsgType {
  if (!content && !item.reactions?.data) {
    return item;
  }

  if (!item.reactions) {
    item.reactions = { count: 0, data: [] };
  }

  if (!item.reactions.data) {
    item.reactions.data = [];
  }

  if (content) {
    item.reactions.data = [
      ...item.reactions.data.filter((r: ReactableType) => r.created_by?.id !== user.id),
      { content: content, created_by: user },
    ];
  } else {
    if (item.reactions.data) {
      item.reactions.data = [...item.reactions.data.filter((r: ReactableType) => r.created_by?.id !== user.id)];
    }
  }

  return item;
}
