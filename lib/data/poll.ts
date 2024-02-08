import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";
import { PollMutationContextType, PollOptionType } from "../types/polls.types";
import { PostType } from "../types/posts.types";

export type MutatePollVariables = {
  optionId: number;
  parentType: "posts" | "comments";
  parentId: number;
};

export type PollMutationType = MutationObserver<PostType, Error, MutatePollVariables, PollMutationContextType>;

export function getPollMutationOptions(weavyContext: WeavyContext, mutationKey: MutationKey) {
  const queryClient = weavyContext.queryClient;
  const key: MutationKey = mutationKey;

  const options = {
    mutationKey: key,
    mutationFn: async ({ optionId }: MutatePollVariables) => {
      const response = await weavyContext.post(`/api/options/${optionId}/vote`, "POST", "");
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
      return response.json();
    },
    onMutate: async (variables: MutatePollVariables) => {
      updateCacheItems(queryClient, { queryKey: key }, variables.parentId, (item: PostType) => {
        item.options = item.options?.map((o: PollOptionType) => {
          if (o.has_voted) {
            o.has_voted = false;
            const count = o.vote_count || 1;
            o.vote_count = count - 1;
          } else if (!o.has_voted && o.id === variables.optionId) {
            o.has_voted = true;
            const count = o.vote_count || 0;
            o.vote_count = count + 1;
          }

          return o;
        });
      });
      //updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.appId, (existingPost: PostType) => Object.assign(existingPost, { is_subscribed: variables.subscribe }));
      return <PollMutationContextType>{ id: variables.optionId };
    },
    onSuccess: async (data: PostType, variables: MutatePollVariables) => {
      const response = await weavyContext.get("/api/" + variables.parentType + "/" + variables.parentId);
      const json = await response.json();

      updateCacheItems(queryClient, { queryKey: key, exact: false }, variables.parentId, (existingPost: PostType) =>
        Object.assign(existingPost, json)
      );
    },
    /*onError(error: Error, variables: MutatePollVariables) {
      updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.id, (existingPost: PostType) => Object.assign(existingPost, { is_subscribed: variables..is_subscribed }));
    },*/
  };

  return options;
}

export function getPollMutation(weavyContext: WeavyContext, mutationKey: MutationKey): PollMutationType {
  return new MutationObserver(weavyContext.queryClient, getPollMutationOptions(weavyContext, mutationKey));
}

export function getVotesOptions(weavyContext: WeavyContext, id: number) {
  return {
    queryKey: ["votes", id],
    enabled: false,
    queryFn: async () => {
      const response = await weavyContext.get(`/api/options/${id}/voters`);
      return await response.json();
    },
  };
}
