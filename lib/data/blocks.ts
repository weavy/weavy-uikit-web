import { type WeavyType } from "../client/weavy";
import { UserOrAgentDetailType, UsersResultType } from "../types/users.types";
import type { QueryObserverOptions } from "@tanstack/query-core";

/**
 * Query options for the ids of the users the authenticated user has blocked.
 *
 * The viewer's own list, rather than the `is_blocked` flag on each user they are handed. Only the detailed user
 * representation carries that flag; list routes, message authors and realtime payloads do not, since an event is mapped
 * once in the sender's request and pushed to every recipient, so anything caller-relative would be answered for the
 * wrong person. A message arriving over the wire says nothing about whether its author is blocked, and without this it
 * would render as if they were not.
 *
 * One request per session answers it for every message in every conversation, however the message arrived, and whether
 * or not the app has a member list to look the author up in. Components track it only where Feature.Block is on --
 * with blocking unavailable there is nothing to create or reveal, so the list would be an empty answer to a question
 * nobody asked.
 *
 * An array rather than a Set, because the query cache is persisted to sessionStorage as JSON -- a Set survives the
 * session but comes back from a reload as `{}`, with no type error to show for it.
 */
export function getBlockedUserIdsOptions(weavy: WeavyType) {
  // the query client is already per weavy instance, so the client does not belong in the key
  return <QueryObserverOptions<number[]>>{
    queryKey: ["blocks"],

    // The set only changes when this user blocks or unblocks someone, and the mutation below invalidates the key when
    // they do -- so there is nothing for a timer to catch. Without this it inherits the client's 1s staleTime and
    // refetches on every mount, window focus and reconnect, which for a list that answers "who have I blocked" is pure
    // noise. The cost is that a block made in another tab or on another device is not picked up until a reload.
    staleTime: Infinity,

    queryFn: async () => {
      const blocked: number[] = [];

      // take is capped at 100 server-side, so page until the count is covered. Blocks per user are few, so this is a
      // single request in practice; the loop is here so a hundred-and-first blocked author is not silently shown.
      let skip = 0;
      for (;;) {
        const response = await weavy.fetch(`/api/user/blocks?skip=${skip}&take=100`);
        if (!response.ok) {
          // thrown rather than swallowed, so a failed read retries instead of settling on "nobody is blocked" and
          // quietly showing what a block should have held back
          throw await response.json();
        }
        const result = (await response.json()) as UsersResultType;
        result.data?.forEach((user) => blocked.push(user.id));

        if (!result.end || result.end >= result.count) {
          break;
        }
        skip = result.end;
      }

      return blocked;
    },
  };
}

export type MutateUserBlockProps = {
  block: boolean;
};

export type MutateUserBlockContextType = { block: boolean } | undefined;

/**
 * Mutation options for blocking and unblocking a user.
 *
 * Blocking changes what the blocker sees in a lot of places at once -- conversation lists, member lists, search results
 * and the profile card -- and the server derives every one of those flags per request. Rather than patch each cache by
 * hand, the profile is updated optimistically so the card flips immediately, and everything else is invalidated once the
 * request settles.
 */
export function getUserBlockMutationOptions(weavy: WeavyType, uid: number | string) {
  const queryClient = weavy.queryClient;
  const options = {
    mutationKey: ["users", uid, "block"],
    mutationFn: async ({ block }: MutateUserBlockProps) => {
      if (!uid) {
        throw new Error(`Could not ${block ? "block" : "unblock"} user ${uid}.`);
      }
      const response = await weavy.fetch(`/api/users/${uid}/blocks`, {
        method: block ? "POST" : "DELETE",
      });
      if (!response.ok) {
        throw await response.json();
      }
    },
    onMutate: ({ block }: MutateUserBlockProps) => {
      queryClient.setQueryData(["users", uid], (user: UserOrAgentDetailType) => ({
        ...user,
        is_blocked: block,
      }));

      const mutationContext: MutateUserBlockContextType = { block };
      return mutationContext;
    },
    onSettled: async () => {
      // Conversation lists carry is_blocked and a suppressed unread flag, member lists and app-scoped searches carry
      // the per-user flag, the profile carries it too, and ["blocks"] is the whole set. All of them are stale the
      // moment a block flips. Runs on failure as well, so it also undoes the optimistic write in onMutate.
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["apps"], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["blocks"], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["members"], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["search__members"], exact: false }),
        queryClient.invalidateQueries({ queryKey: ["users"], exact: false }),
      ]);
    },
  };
  return options;
}
