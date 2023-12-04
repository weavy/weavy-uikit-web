import { MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";

/// POST to add a meeting
export function addMeetingMutation(weavyContext: WeavyContext, provider: "zoom" | "teams") {
  return new MutationObserver(weavyContext.queryClient, {
    mutationFn: async () => {
      const response = await weavyContext.post(`/api/meetings`, "POST", JSON.stringify({ provider: provider }));
      return await response.json();
    },
  });
}
