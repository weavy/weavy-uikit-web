import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
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

export function getPollMutationOptions(weavy: WeavyType, mutationKey: MutationKey) {
  const queryClient = weavy.queryClient;
  const key: MutationKey = mutationKey;

  const options = {
    mutationKey: key,
    mutationFn: async ({ optionId }: MutatePollVariables) => {
      const response = await weavy.post(`/api/options/${optionId}/vote`, "POST", "");
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
      return response.json();
    },
    onMutate: async (variables: MutatePollVariables) => {
      updateCacheItems(queryClient, { queryKey: key }, variables.parentId, (item: PostType) => {        
        if (item.options?.data) {
          item.options.data = item.options.data?.map((o: PollOptionType) => {            
            if (o.has_voted) {
              o.has_voted = false;
              const count = o.votes?.count || 1;
              o.votes!.count = count - 1;
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
      });
      //updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.appId, (existingPost: PostType) => Object.assign(existingPost, { is_subscribed: variables.subscribe }));
      return <PollMutationContextType>{ id: variables.optionId };
    },
    onSuccess: async (data: PostType, variables: MutatePollVariables) => {
      const response = await weavy.get("/api/" + variables.parentType + "/" + variables.parentId);
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

export function getPollMutation(weavy: WeavyType, mutationKey: MutationKey): PollMutationType {
  return new MutationObserver(weavy.queryClient, getPollMutationOptions(weavy, mutationKey));
}

export function getVotesOptions(weavy: WeavyType, id: number) {
  return {
    queryKey: ["votes", id],
    enabled: false,
    queryFn: async () => {
      const response = await weavy.get(`/api/options/${id}`);
      return await response.json();
    },
  };
}
