import { MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";

/// POST to indicate typing
export function typingMutation(
  weavy: WeavyType,
  conversationId: number | null,
) {
  return new MutationObserver(weavy.queryClient, {
    mutationFn: async () => {
      const response = await weavy.post(`/api/conversations/${conversationId}/typing`, "PUT", JSON.stringify({}));
      return response;
    },
  });
}
