import { MutationObserver } from "@tanstack/query-core";
import { type WeavyContextType } from "../client/weavy-context";

/// POST to indicate typing
export function typingMutation(
  weavyContext: WeavyContextType,
  conversationId: number | null,
) {
  return new MutationObserver(weavyContext.queryClient, {
    mutationFn: async () => {
      const response = await weavyContext.post(`/api/conversations/${conversationId}/typing`, "PUT", JSON.stringify({}));
      return response;
    },
  });
}
