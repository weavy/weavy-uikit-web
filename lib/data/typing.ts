import { MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";

/// POST to indicate typing
export function typingMutation(weavy: WeavyType, conversationId: number | null) {
  return new MutationObserver(weavy.queryClient, {
    mutationFn: async () => {
      const response = await weavy.fetch(`/api/apps/${conversationId}/typing`, {
        method: "PUT",
        body: JSON.stringify({}),
      });
      return response;
    },
  });
}
