import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { PostType } from "../types/posts.types";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";
import type { AppType } from "../types/app.types";

export type MutatePostVariables = {
  id: number;
};

export type RemovePostMutationType = MutationObserver<void, Error, MutatePostVariables, void>;
export type DeleteForeverPostMutationType = MutationObserver<void, Error, MutatePostVariables>;

export function getTrashPostMutationOptions(weavy: WeavyType, app: AppType) {
  const queryClient = weavy.queryClient;
  const postsKey: MutationKey = ["posts", app.id];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id }: MutatePostVariables) => {
      const response = await weavy.fetch("/api/posts/" + id + "/trash", { method: "POST" });
      if (!response.ok) {
        throw new Error();
      }
    },
    onMutate: (variables: MutatePostVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingPost: PostType) => Object.assign(existingPost, { is_trashed: true })
      );
    },
    onSuccess: (data: void, variables: MutatePostVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingPost: PostType) => Object.assign(existingPost, data)
      );
    }
  };

  return options;
}

export function getTrashPostMutation(weavy: WeavyType, app: AppType): RemovePostMutationType {
  return new MutationObserver(weavy.queryClient, getTrashPostMutationOptions(weavy, app));
}

export function getRestorePostMutationOptions(weavy: WeavyType, app: AppType) {
  const queryClient = weavy.queryClient;
  const postsKey: MutationKey = ["posts", app.id];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id }: MutatePostVariables) => {
      const response = await weavy.fetch("/api/posts/" + id + "/restore", { method: "POST" });
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
    },
    onMutate: (variables: MutatePostVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingPost: PostType) => Object.assign(existingPost, { is_trashed: false })
      );
    },
    onSuccess: (data: void, variables: MutatePostVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingPost: PostType) => Object.assign(existingPost, { is_trashed: false })
      );
    }
  };

  return options;
}

export function getRestorePostMutation(weavy: WeavyType, app: AppType): RemovePostMutationType {
  return new MutationObserver(weavy.queryClient, getRestorePostMutationOptions(weavy, app));
}
