import { type WeavyType } from "../client/weavy";
import { updateCacheItem, updateCacheItems } from "../utils/query-cache";
import { MsgType } from "../types/msg.types";

/**
 * The entity kinds that can be reported, matching the API route segment.
 *
 * Reporting is entity-agnostic on the server, so widening this is a matter of adding the route there and the string here.
 */
export type ReportEntityType = "messages" | "posts" | "comments" | "users";

export type MutateReportProps = {
  entityType: ReportEntityType;
  entityId: number | string;
  /**
   * App the message or post belongs to. Only used to find the entity in the cache, so it can be marked as reported.
   * Not needed for users, whose profiles are refetched, nor for comments, which are cached under their parent.
   */
  appId?: number;
  /** Where the comment list lives (`posts`, `files` or `apps`), the first segment of the comments query key. */
  parentType?: "posts" | "files" | "apps";
  /** The entity the comment belongs to, the last segment of the comments query key. */
  parentId?: number;
};

/**
 * Mutation options for reporting a message, post, comment or user.
 *
 * The server sends `is_reported` on reportable content, so the flag survives a refetch on its own. The cache is patched
 * here as well, so the flag turns red the moment the report succeeds rather than waiting for the next fetch.
 * User profiles are invalidated so their caller-relative reported flag is refreshed.
 *
 * Each content type is cached under a different key shape, so the patch is matched on `entityType`. Posts live in both
 * the per-app list and the cross-app feed, and either may be on screen, so both are patched. Lists carry filter
 * suffixes on their keys, which is why the list patches match on a key prefix rather than exactly.
 */
export function getReportMutationOptions(weavy: WeavyType) {
  const options = {
    mutationKey: ["reports"],
    mutationFn: async ({ entityType, entityId }: MutateReportProps) => {
      const response = await weavy.fetch(`/api/${entityType}/${entityId}/reports`, {
        method: "POST",
      });
      if (!response.ok) {
        throw await response.json();
      }
    },
    onSuccess: async (_data: void, { entityType, entityId, appId, parentType, parentId }: MutateReportProps) => {
      const id = Number(entityId);
      const markReported = (item: MsgType): MsgType => ({ ...item, is_reported: true });

      switch (entityType) {
        case "users":
          await weavy.queryClient.invalidateQueries({ queryKey: ["users"] });
          break;
        case "messages":
          if (appId) {
            updateCacheItem<MsgType>(weavy.queryClient, ["messages", appId], id, markReported);
          }
          break;
        case "posts":
          if (appId) {
            updateCacheItems<MsgType>(
              weavy.queryClient,
              [
                { queryKey: ["posts", appId], exact: false },
                { queryKey: ["posts", "feed"], exact: false },
              ],
              id,
              markReported,
            );
          }
          break;
        case "comments":
          if (parentType && parentId) {
            updateCacheItems<MsgType>(
              weavy.queryClient,
              { queryKey: [parentType, "comments", parentId], exact: false },
              id,
              markReported,
            );
          }
          break;
      }
    },
  };
  return options;
}
