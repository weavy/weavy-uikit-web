import { type MutationKey, MutationObserver, QueryKey } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { ServerErrorResponseType } from "../types/server.types";
import { hasInfiniteResultDataId, updateCacheItems } from "../utils/query-cache";
import { PollMutationContextType, PollOptionType, PollParentTypes } from "../types/polls.types";
import { PostType } from "../types/posts.types";
import { MsgType } from "../types/msg.types";
import type { RealtimeGroupType, RealtimeOptionsType, RealtimeVoteEventType } from "../types/realtime.types";
import type { InfiniteData } from "@tanstack/query-core";
import type { InfiniteQueryResultType } from "../types/query.types";

export type MutatePollVariables = {
  optionId: number;
  parentType: PollParentTypes;
  parentId: number;
};

export type PollMutationType = MutationObserver<MsgType, Error, MutatePollVariables, PollMutationContextType>;

export function getPollMutationOptions(weavy: WeavyType, appId: number | "feed", cacheKey: QueryKey) {
  const queryClient = weavy.queryClient;

  const key: MutationKey = ["polls", appId === "feed" ? "feed" : appId];

  const options = {
    mutationKey: key,
    mutationFn: async ({ optionId }: MutatePollVariables) => {
      const response = await weavy.fetch(`/api/options/${optionId}/vote`, { method: "POST" });
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
      return await response.json() as MsgType;
    },
    onMutate: (variables: MutatePollVariables) => {    
      updateCacheItems<PostType>(queryClient, { queryKey: cacheKey }, variables.parentId, (item) => {                
        if (item.options?.data) {
          item.options.data = item.options.data?.map((o: PollOptionType) => {            
            if (o.has_voted) {
              o.has_voted = false;
              const count = o.votes?.count || 1;
              if (o.votes) {
                o.votes.count = count - 1;
              } else {
                o.votes = { count: count - 1 };
              }
            } else if (!o.has_voted && o.id === variables.optionId) {
              o.has_voted = true;
              const count = o.votes?.count || 0;
              if (o.votes) {
                o.votes.count = count + 1;
              } else {
                o.votes = { count: count + 1 };
              }
            }

            return o;
          });
        }
        return item
      });
      //updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.appId, (existingPost: PostType) => Object.assign(existingPost, { is_subscribed: variables.subscribe }));
      return <PollMutationContextType>{ id: variables.optionId };
    },
    onSuccess: async (data: MsgType, variables: MutatePollVariables) => {
      // Goes through the same shared query as the realtime vote handler: the voter's own client also receives the
      // vote event it caused, and the two must not turn into two fetches of the same parent.
      await refreshPollOptions(weavy, variables.parentType, variables.parentId, cacheKey);
    },
    /*onError(error: Error, variables: MutatePollVariables) {
      updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.id, (existingPost: PostType) => Object.assign(existingPost, { is_subscribed: variables..is_subscribed }));
    },*/
  };

  return options;
}

export function getPollMutation(weavy: WeavyType, appId: number | "feed", cacheKey: QueryKey): PollMutationType {
  return new MutationObserver(weavy.queryClient, getPollMutationOptions(weavy, appId, cacheKey));
}


/**
 * Replaces the poll options of a cached post, message or comment with the ones the server has now.
 *
 * Used after a vote from someone else arrives. The event cannot be applied directly: its poll summary carries option
 * counts only, its option is just the one voted for (a single-choice poll also drops the voter's previous vote on
 * another option), and `has_voted` in it was rendered for the actor, not for this user. A fetch of the parent gives
 * every option with counts and the current user's own `has_voted`.
 *
 * @param weavy - The Weavy instance.
 * @param parentType - API path segment of the poll's parent type.
 * @param pollId - Id of the post, message or comment holding the poll.
 * @param cacheKey - Query key prefix of the list(s) holding the poll.
 */
export async function refreshPollOptions(
  weavy: WeavyType,
  parentType: PollParentTypes,
  pollId: number,
  cacheKey: QueryKey,
) {
  let fetched: MsgType;
  try {
    // A vote reaches the voter's client twice, from the mutation and from the realtime event it caused. The fetch
    // goes through a query so a caller arriving while it is in flight joins that request instead of starting its
    // own. Only in-flight requests are shared: a completed result is never reused (staleTime 0), since the next
    // call may be for a later vote, a fast second click or someone else's, and must see that state. The entry
    // is dropped right after; the lists are the real cache and it only exists to coalesce the fetches.
    fetched = await weavy.queryClient.fetchQuery<MsgType>({
      queryKey: ["poll", parentType, pollId],
      queryFn: async () => {
        const response = await weavy.fetch(`/api/${parentType}/${pollId}`);
        if (!response.ok) {
          throw new Error(`Could not fetch ${parentType} ${pollId}.`);
        }
        return (await response.json()) as MsgType;
      },
      staleTime: 0,
      gcTime: 0,
    });
  } catch {
    // The cached options stay as they were; the next vote or a reload brings the real state.
    return;
  }

  updateCacheItems<MsgType>(weavy.queryClient, { queryKey: cacheKey, exact: false }, pollId, (item) =>
    Object.assign(item, { options: fetched.options }),
  );
}

/**
 * Applies a `vote_added` / `vote_removed` event to the list cache of a poll host.
 *
 * Every host subscribed to the app group gets every vote event in it, whatever the poll's parent type, so a host
 * only acts when the poll is in its own cache; a post host ignores votes on message polls and so on. The voter's own
 * client refetches here too, as well as from the vote mutation: the second fetch is cheap and keeps the user's
 * other tabs in sync, which an actor check would break.
 *
 * @param weavy - The Weavy instance.
 * @param parentType - API path segment of the poll's parent type.
 * @param cacheKey - Query key prefix of the list(s) holding the poll.
 * @param realtimeEvent - The vote event.
 * @returns A promise that resolves when the cache is updated, or `undefined` when the event was not for this host.
 */
export function handleRealtimeVote(
  weavy: WeavyType,
  parentType: PollParentTypes,
  cacheKey: QueryKey,
  realtimeEvent: RealtimeVoteEventType,
) {
  const pollId = realtimeEvent.poll?.id;
  const cached = weavy.queryClient
    .getQueriesData<InfiniteData<InfiniteQueryResultType<MsgType>>>({ queryKey: cacheKey, exact: false })
    .some(([, data]) => hasInfiniteResultDataId(data, pollId));

  if (!cached) {
    return;
  }

  return refreshPollOptions(weavy, parentType, pollId, cacheKey);
}

/**
 * Realtime subscription options for `vote_added` and `vote_removed` on the polls of a list.
 *
 * @param weavy - The Weavy instance.
 * @param group - Realtime group of the app holding the polls.
 * @param parentType - API path segment of the poll's parent type.
 * @param cacheKey - Query key prefix of the list(s) holding the polls.
 */
export function getRealtimeVoteOptions(
  weavy: WeavyType,
  group: RealtimeGroupType,
  parentType: PollParentTypes,
  cacheKey: QueryKey,
): RealtimeOptionsType[] {
  const onMessage = (realtimeEvent: RealtimeVoteEventType) =>
    handleRealtimeVote(weavy, parentType, cacheKey, realtimeEvent);

  // Asserted like the other realtime option builders: the controller types every handler on the base event.
  return [
    <RealtimeOptionsType>{ group, event: "vote_added", onMessage },
    <RealtimeOptionsType>{ group, event: "vote_removed", onMessage },
  ];
}

export function getVotesOptions(weavy: WeavyType, id: number) {
  return {
    queryKey: ["votes", id],
    enabled: false,
    queryFn: async () => {
      const response = await weavy.fetch(`/api/options/${id}`);
      return await response.json() as PollOptionType;
    },
  };
}
