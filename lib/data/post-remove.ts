import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import type { PostMutationContextType, PostType } from "../types/posts.types";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";
import type { AppType } from "../types/app.types";

export type MutatePostVariables = {
  id: number;
};

export type RemovePostMutationType = MutationObserver<PostType, Error, MutatePostVariables, PostMutationContextType>;
export type DeleteForeverPostMutationType = MutationObserver<void, Error, MutatePostVariables, PostMutationContextType>;

export function getTrashPostMutationOptions(weavyContext: WeavyContext, app: AppType) {
  const queryClient = weavyContext.queryClient;
  const postsKey: MutationKey = ["posts", app.id];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id }: MutatePostVariables) => {
      const response = await weavyContext.post("/api/posts/" + id + "/trash", "POST", "");
      return response.json();
    },
    onMutate: async (variables: MutatePostVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingPost: PostType) => Object.assign(existingPost, { is_trashed: true })
      );
      return <PostMutationContextType>{ type: "trash", id: variables.id };
    },
    onSuccess: (data: PostType, variables: MutatePostVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingPost: PostType) => Object.assign(existingPost, data)
      );
    },
    /*onError(error: Error, variables: MutatePostVariables, _context: PostMutationContextType) {
      //updateCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id, (existingFile: FileType) => Object.assign(existingFile, { is_trashed: false }))
    },*/
  };

  return options;
}

export function getTrashPostMutation(weavyContext: WeavyContext, app: AppType): RemovePostMutationType {
  return new MutationObserver(weavyContext.queryClient, getTrashPostMutationOptions(weavyContext, app));
}

export function getRestorePostMutationOptions(weavyContext: WeavyContext, app: AppType) {
  const queryClient = weavyContext.queryClient;
  const postsKey: MutationKey = ["posts", app.id];

  const options = {
    mutationKey: postsKey,
    mutationFn: async ({ id }: MutatePostVariables) => {
      const response = await weavyContext.post("/api/posts/" + id + "/restore", "POST", "");
      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
      return response.json();
    },
    onMutate: async (variables: MutatePostVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingPost: PostType) => Object.assign(existingPost, { is_trashed: false })
      );
      return <PostMutationContextType>{ type: "restore", file: variables.id };
    },
    onSuccess: (data: PostType, variables: MutatePostVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.id,
        (existingPost: PostType) => Object.assign(existingPost, data)
      );
    },
    /*onError(error: Error, variables: MutatePostVariables, _context: any) {
      //updateCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id, (existingFile: FileType) => Object.assign(existingFile, { is_trashed: true }))
    },*/
  };

  return options;
}

export function getRestorePostMutation(weavyContext: WeavyContext, app: AppType): RemovePostMutationType {
  return new MutationObserver(weavyContext.queryClient, getRestorePostMutationOptions(weavyContext, app));
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
