import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";
import { PollMutationContextType, PollOptionType, PollParentTypes } from "../types/polls.types";
import { PostType } from "../types/posts.types";
import { MsgType } from "../types/msg.types";

export type MutatePollVariables = {
  optionId: number;
  parentType: PollParentTypes;
  parentId: number;
};

export type PollMutationType = MutationObserver<MsgType, Error, MutatePollVariables, PollMutationContextType>;

export function getPollMutationOptions(weavy: WeavyType, appId: number) {
  const queryClient = weavy.queryClient;
  const key: MutationKey = ["apps", appId, "polls"];

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
      updateCacheItems(queryClient, { queryKey: key }, variables.parentId, (item: PostType) => {                
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
      });
      //updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.appId, (existingPost: PostType) => Object.assign(existingPost, { is_subscribed: variables.subscribe }));
      return <PollMutationContextType>{ id: variables.optionId };
    },
    onSuccess: async (data: MsgType, variables: MutatePollVariables) => {
      const response = await weavy.fetch("/api/" + variables.parentType + "/" + variables.parentId);
      const fetchedMsg = await response.json() as MsgType;

      updateCacheItems(queryClient, { queryKey: key, exact: false }, variables.parentId, (existingPost: MsgType) =>
        Object.assign(existingPost, fetchedMsg)
      );
    },
    /*onError(error: Error, variables: MutatePollVariables) {
      updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.id, (existingPost: PostType) => Object.assign(existingPost, { is_subscribed: variables..is_subscribed }));
    },*/
  };

  return options;
}

export function getPollMutation(weavy: WeavyType, appId: number): PollMutationType {
  return new MutationObserver(weavy.queryClient, getPollMutationOptions(weavy, appId));
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
