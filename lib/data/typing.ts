import { MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";

/// POST to indicate typing
export function typingMutation(
  weavyContext: WeavyContext,
  appId: number | null,
  location: "messages" | "posts" | "apps" | "files",
  type: "messages" | "posts" | "comments"
) {
  return new MutationObserver(weavyContext.queryClient, {
    mutationFn: async () => {
      const response = await weavyContext.post(`/api/${location}/${appId}/${type}/typing`, "PUT", JSON.stringify({}));
      return response;
    },
  });
}
