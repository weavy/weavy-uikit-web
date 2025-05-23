import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";

import { AppType } from "../types/app.types";
import { PostType } from "../types/posts.types";

export type MutatePostSubscribeVariables = {
  id: number;
  subscribe: boolean;
};

export type SubscribePostMutationType = MutationObserver<
  PostType,
  Error,
  MutatePostSubscribeVariables,
  void
>;

export function getSubscribePostMutationOptions(weavy: WeavyType, app: AppType) {
  const queryClient = weavy.queryClient;
  const postsKey: MutationKey = ["posts", app.id];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id, subscribe }: MutatePostSubscribeVariables) => {
      const response = await weavy.fetch(
        `/api/posts/${id}/${subscribe ? "subscribe" : "unsubscribe"}`,
        { method: "POST" }
      );
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
      return await response.json() as PostType;
    },
    onMutate: (variables: MutatePostSubscribeVariables) => {
      updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.id, (existingPost: PostType) =>
        Object.assign(existingPost, { is_subscribed: variables.subscribe })
      );
    },
    onSuccess: (data: PostType, variables: MutatePostSubscribeVariables) => {
      updateCacheItems(queryClient, { queryKey: postsKey, exact: false }, variables.id, (existingPost: PostType) =>
        Object.assign(existingPost, data)
      );
    }
  };

  return options;
}

export function getSubscribePostMutation(weavy: WeavyType, app: AppType): SubscribePostMutationType {
  return new MutationObserver(weavy.queryClient, getSubscribePostMutationOptions(weavy, app));
}
