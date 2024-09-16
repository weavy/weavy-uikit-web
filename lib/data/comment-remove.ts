import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
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
  void,
  Error,
  MutateCommentVariables,
  CommentMutationContextType
>;

export function getTrashCommentMutationOptions(weavy: WeavyType, parentId: number) {
  const queryClient = weavy.queryClient;
  const commentsKey: MutationKey = ["comments", parentId];

  const options = {
    mutationKey: commentsKey,
    mutationFn: async ({ id }: MutateCommentVariables) => {
      const response = await weavy.post("/api/comments/" + id + "/trash", "POST", "");
      
      if (!response.ok) {
        throw new Error();
      }
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
    },
    /*onError(error: Error, variables: MutateCommentVariables, _context: any) {
      updateCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id, (existingFile: FileType) => Object.assign(existingFile, { is_trashed: false }))
    },*/
  };

  return options;
}

export function getTrashCommentMutation(weavy: WeavyType, parentId: number): RemoveCommentMutationType {
  return new MutationObserver(weavy.queryClient, getTrashCommentMutationOptions(weavy, parentId));
}

export function getRestoreCommentMutationOptions(weavy: WeavyType, parentId: number) {
  const queryClient = weavy.queryClient;
  const postsKey: MutationKey = ["comments", parentId];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id }: MutateCommentVariables) => {
      const response = await weavy.post("/api/comments/" + id + "/restore", "POST", "");
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }      
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
    },
    /*onError(error: Error, variables: MutateCommentVariables, _context: any) {
      updateCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id, (existingFile: FileType) => Object.assign(existingFile, { is_trashed: true }))
    },*/
  };

  return options;
}

export function getRestoreCommentMutation(weavy: WeavyType, parentId: number): RemoveCommentMutationType {
  return new MutationObserver(weavy.queryClient, getRestoreCommentMutationOptions(weavy, parentId));
}

// export function getDeleteForeverFileMutationOptions(weavy: WeavyType, app: AppType) {
//     const queryClient = weavy.queryClient
//     const filesKey: MutationKey = ["apps", app.id, "files"]

//     const options = {
//         mutationKey: filesKey,
//         mutationFn: async ({ file }: MutateFileVariables) => {
//             if (file.id >= 1 && file.is_trashed) {
//                 const response = await weavy.post("/api/files/" + file.id, "DELETE","")
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

// export function getDeleteForeverFileMutation(weavy: WeavyType, app: AppType): DeleteForeverFileMutationType {
//     return new MutationObserver(weavy.queryClient, getDeleteForeverFileMutationOptions(weavy, app))
// }
