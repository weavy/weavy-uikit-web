import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import type { PostMutationContextType, PostType } from "../types/posts.types";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItem, updateCacheItems } from "../utils/query-cache";

import { CommentMutationContextType, CommentType } from "../types/comments.types";

export type MutateCommentVariables = {
  id: number;
  appId: number;
  type: "posts" | "files" | "apps";
  parentId: number;
};

export type RemoveCommentMutationType = MutationObserver<
  CommentType,
  Error,
  MutateCommentVariables,
  CommentMutationContextType
>;

export function getTrashCommentMutationOptions(weavyContext: WeavyContext, parentId: number) {
  const queryClient = weavyContext.queryClient;
  const commentsKey: MutationKey = ["comments", parentId];

  const options = {
    mutationKey: commentsKey,
    mutationFn: async ({ id }: MutateCommentVariables) => {
      const response = await weavyContext.post("/api/comments/" + id + "/trash", "POST", "");
      return response.json();
    },
    onMutate: async (variables: MutateCommentVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingComment: CommentType) => Object.assign(existingComment, { is_trashed: true })
      );
      return <CommentMutationContextType>{ type: "trash", id: variables.id };
    },
    onSuccess: (data: CommentType, variables: MutateCommentVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingComment: CommentType) => Object.assign(existingComment, data)
      );
      updateCacheItem(queryClient, [variables.type, variables.appId], variables.parentId, (item: PostType) => {
        item.comment_count = (item.comment_count || 1) - 1;
      });
    },
    /*onError(error: Error, variables: MutateCommentVariables, _context: any) {
      updateCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id, (existingFile: FileType) => Object.assign(existingFile, { is_trashed: false }))
    },*/
  };

  return options;
}

export function getTrashCommentMutation(weavyContext: WeavyContext, parentId: number): RemoveCommentMutationType {
  return new MutationObserver(weavyContext.queryClient, getTrashCommentMutationOptions(weavyContext, parentId));
}

export function getRestoreCommentMutationOptions(weavyContext: WeavyContext, parentId: number) {
  const queryClient = weavyContext.queryClient;
  const postsKey: MutationKey = ["comments", parentId];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id }: MutateCommentVariables) => {
      const response = await weavyContext.post("/api/comments/" + id + "/restore", "POST", "");
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
      return response.json();
    },
    onMutate: async (variables: MutateCommentVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingComment: CommentType) => Object.assign(existingComment, { is_trashed: false })
      );
      return <PostMutationContextType>{ type: "restore", file: variables.id };
    },
    onSuccess: (data: CommentType, variables: MutateCommentVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingComment: CommentType) => Object.assign(existingComment, data)
      );
      updateCacheItem(queryClient, [variables.type, variables.appId], variables.parentId, (item: PostType) => {
        item.comment_count = (item.comment_count || 0) + 1;
      });
    },
    /*onError(error: Error, variables: MutateCommentVariables, _context: any) {
      updateCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id, (existingFile: FileType) => Object.assign(existingFile, { is_trashed: true }))
    },*/
  };

  return options;
}

export function getRestoreCommentMutation(weavyContext: WeavyContext, parentId: number): RemoveCommentMutationType {
  return new MutationObserver(weavyContext.queryClient, getRestoreCommentMutationOptions(weavyContext, parentId));
}

// export function getDeleteForeverFileMutationOptions(weavyContext: WeavyContext, app: AppType) {
//     const queryClient = weavyContext.queryClient
//     const filesKey: MutationKey = ["apps", app.id, "files"]

//     const options = {
//         mutationKey: filesKey,
//         mutationFn: async ({ file }: MutateFileVariables) => {
//             if (file.id >= 1 && file.is_trashed) {
//                 const response = await weavyContext.post("/api/files/" + file.id, "DELETE","")
//                 if (!response.ok) {
//                     const serverError = <ServerErrorResponseType> await response.json()
//                     throw new Error(serverError.detail || serverError.title, { cause: serverError });
//                 }
//             } else {
//                 const serverError = <ServerErrorResponseType> {status: 400, title: `Could not delete ${file.name} forever.`}
//                 throw new Error(serverError.detail || serverError.title, { cause: serverError });
//             }
//         },
//         onMutate: async (variables: MutateFileVariables) => {
//             updateCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id, (existingFile: FileType) => Object.assign(existingFile, { status: "pending" }))
//             return <FileMutationContextType>{ type: "delete-forever", file: variables.file, status: { state: "pending"} }
//         },
//         onSuccess: (_data: void, variables: MutateFileVariables, _context: any) => {
//             removeCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id);
//             updateMutationContext(queryClient, options.mutationKey, variables, (context: FileMutationContextType) => { context.status.state = "ok" })
//         },
//         onError(error: Error, variables: MutateFileVariables, _context: any) {
//             // Show in error list instead?
//             updateCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id, (existingFile: FileType) => Object.assign(existingFile, { status: undefined }))
//             updateMutationContext(queryClient, options.mutationKey, variables, (context: FileMutationContextType) => { context.status.state = "error"; context.status.text = error.message; })
//         },
//     }

//     return options
// }

// export function getDeleteForeverFileMutation(weavyContext: WeavyContext, app: AppType): DeleteForeverFileMutationType {
//     return new MutationObserver(weavyContext.queryClient, getDeleteForeverFileMutationOptions(weavyContext, app))
// }
