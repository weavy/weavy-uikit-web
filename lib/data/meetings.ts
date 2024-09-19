import { MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import { MeetingType } from "../types/meetings.types";

/// POST to add a meeting
export function addMeetingMutation(weavy: WeavyType, name: string) {
  return new MutationObserver(weavy.queryClient, {
    mutationFn: async () => {
      const response = await weavy.fetch(`/x/${name}/meetings`, { method: "POST" });

      if (!response.ok) {
        throw new Error("Failed to create meeting");
      }
      return (await response.json()) as MeetingType;
    },
  });
}
