import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { PostType } from "../types/posts.types";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItem, updateCacheItems } from "../utils/query-cache";

import { CommentType } from "../types/comments.types";

export type MutateCommentVariables = {
  id: number;
  appId: number;
  type: "posts" | "files" | "apps";
  parentId: number;
};

export type RemoveCommentMutationType = MutationObserver<
  void,
  Error,
  MutateCommentVariables,
  void
>;

export function getTrashCommentMutationOptions(weavy: WeavyType, type: "posts" | "files" | "apps", parentId: number) {
  const queryClient = weavy.queryClient;
  const commentsKey: MutationKey = [type, parentId, "comments"];

  const options = {
    mutationKey: commentsKey,
    mutationFn: async ({ id }: MutateCommentVariables) => {
      const response = await weavy.fetch("/api/comments/" + id + "/trash", { method: "POST" });
      
      if (!response.ok) {
        throw new Error();
      }
    },
    onMutate: (variables: MutateCommentVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingComment: CommentType) => Object.assign(existingComment, { is_trashed: true })
      );
    },
    onSuccess: (data: void, variables: MutateCommentVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingComment: CommentType) => Object.assign(existingComment, data)
      );
      updateCacheItem(queryClient, [variables.type, variables.appId], variables.parentId, (item: PostType) => {
        item.comments.count -= 1;
      });
    }
  };

  return options;
}

export function getTrashCommentMutation(weavy: WeavyType, type: "posts" | "files" | "apps",  parentId: number): RemoveCommentMutationType {
  return new MutationObserver(weavy.queryClient, getTrashCommentMutationOptions(weavy, type, parentId));
}

export function getRestoreCommentMutationOptions(weavy: WeavyType, type: "posts" | "files" | "apps", parentId: number) {
  const queryClient = weavy.queryClient;
  const postsKey: MutationKey = [type, parentId, "comments" ];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id }: MutateCommentVariables) => {
      const response = await weavy.fetch("/api/comments/" + id + "/restore", { method: "POST" });
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }      
    },
    onMutate: (variables: MutateCommentVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingComment: CommentType) => Object.assign(existingComment, { is_trashed: false })
      );
    },
    onSuccess: (data: void, variables: MutateCommentVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingComment: CommentType) => Object.assign(existingComment, data)
      );
      updateCacheItem(queryClient, [variables.type, variables.appId], variables.parentId, (item: PostType) => {
        item.comments.count += 1;
      });
    }
  };

  return options;
}

export function getRestoreCommentMutation(weavy: WeavyType, type: "posts" | "files" | "apps", parentId: number): RemoveCommentMutationType {
  return new MutationObserver(weavy.queryClient, getRestoreCommentMutationOptions(weavy, type, parentId));
}
