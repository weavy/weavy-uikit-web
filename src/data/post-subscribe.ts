import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";

import { AppType } from "../types/app.types";
import { PostMutationContextType, PostType } from "../types/posts.types";

export type MutatePostSubscribeVariables = {
  id: number;
  subscribe: boolean;
};

export type SubscribePostMutationType = MutationObserver<
  PostType,
  Error,
  MutatePostSubscribeVariables,
  PostMutationContextType
>;

export function getSubscribePostMutationOptions(weavyContext: WeavyContext, app: AppType) {
  const queryClient = weavyContext.queryClient;
  const postsKey: MutationKey = ["posts", app.id];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id, subscribe }: MutatePostSubscribeVariables) => {
      const response = await weavyContext.post(
        `/api/posts/${id}/${subscribe ? "subscribe" : "unsubscribe"}`,
        "POST",
        ""
      );
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
      return response.json();
    },
    onMutate: async (variables: MutatePostSubscribeVariables) => {
      updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.id, (existingPost: PostType) =>
        Object.assign(existingPost, { is_subscribed: variables.subscribe })
      );
      return <PostMutationContextType>{ type: variables.subscribe ? "subscribe" : "unsubscribe", id: variables.id };
    },
    onSuccess: (data: PostType, variables: MutatePostSubscribeVariables) => {
      updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.id, (existingPost: PostType) =>
        Object.assign(existingPost, data)
      );
    },
    onError() {
      //updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.id, (existingPost: PostType) => Object.assign(existingPost, { is_subscribed: variables..is_subscribed }));
    },
  };

  return options;
}

export function getSubscribePostMutation(weavyContext: WeavyContext, app: AppType): SubscribePostMutationType {
  return new MutationObserver(weavyContext.queryClient, getSubscribePostMutationOptions(weavyContext, app));
}
