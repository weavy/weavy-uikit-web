import { MutationObserver } from "@tanstack/query-core";
import { type WeavyContextType } from "../client/weavy";
import { MeetingType } from "../types/meetings.types";

/// POST to add a meeting
export function addMeetingMutation(weavyContext: WeavyContextType, name: string) {
  return new MutationObserver(weavyContext.queryClient, {
    mutationFn: async () => {
      const response = await weavyContext.post(`/x/${name}/meetings`, "POST");      

      if (!response.ok) {
        throw new Error("Failed to create meeting");
      }
      return await response.json() as MeetingType;
    }
  });
}