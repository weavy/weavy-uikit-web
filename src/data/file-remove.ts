import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import type { FileMutationContextType, FileType } from "../types/files.types";
import type { ServerErrorResponseType } from "../types/server.types";
import { removeCacheItems, updateCacheItems } from "../utils/query-cache";
import { updateMutationContext } from "../utils/mutation-cache";
import type { AppType } from "../types/app.types";

export type MutateFileVariables = {
  file: FileType;
};

export type RemoveFileMutationType = MutationObserver<FileType, Error, MutateFileVariables, FileMutationContextType>;
export type DeleteForeverFileMutationType = MutationObserver<void, Error, MutateFileVariables, FileMutationContextType>;

export function getTrashFileMutationOptions(weavyContext: WeavyContext, app: AppType) {
  const queryClient = weavyContext.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationKey: filesKey,
    mutationFn: async ({ file }: MutateFileVariables) => {
      if (file.id >= 1) {
        const response = await weavyContext.post("/api/files/" + file.id + "/trash", "POST", "");
        return response.json();
      } else {
        throw new Error(`Could not trash ${file.name}.`);
      }
    },
    onMutate: async (variables: MutateFileVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { is_trashed: true })
      );
      return <FileMutationContextType>{ type: "trash", file: variables.file, status: { state: "pending" } };
    },
    onSuccess: (data: FileType, variables: MutateFileVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, data)
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
      });
    },
    onError(error: Error, variables: MutateFileVariables) {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { is_trashed: false })
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "error";
        (context as FileMutationContextType).status.text = error.message;
      });
    },
  };

  return options;
}

export function getTrashFileMutation(weavyContext: WeavyContext, app: AppType): RemoveFileMutationType {
  return new MutationObserver(weavyContext.queryClient, getTrashFileMutationOptions(weavyContext, app));
}

export function getRestoreFileMutationOptions(weavyContext: WeavyContext, app: AppType) {
  const queryClient = weavyContext.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationKey: filesKey,
    mutationFn: async ({ file }: MutateFileVariables) => {
      if (file.id >= 1) {
        const response = await weavyContext.post("/api/files/" + file.id + "/restore", "POST", "");
        if (!response.ok) {
          const serverError = <ServerErrorResponseType>await response.json();
          throw new Error(serverError.detail || serverError.title, { cause: serverError });
        }
        return response.json();
      } else {
        const serverError = <ServerErrorResponseType>{ status: 400, title: `Could not restore ${file.name}.` };
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
    },
    onMutate: async (variables: MutateFileVariables) => {
      // File must be considered trashed until successful restore
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { status: "pending" })
      );
      return <FileMutationContextType>{ type: "restore", file: variables.file, status: { state: "pending" } };
    },
    onSuccess: (data: FileType, variables: MutateFileVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, data, { is_trashed: false, status: "ok" })
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
      });
    },
    onError(error: Error, variables: MutateFileVariables) {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { is_trashed: true })
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "error";
        (context as FileMutationContextType).status.text = error.message;
      });
    },
  };

  return options;
}

export function getRestoreFileMutation(weavyContext: WeavyContext, app: AppType): RemoveFileMutationType {
  return new MutationObserver(weavyContext.queryClient, getRestoreFileMutationOptions(weavyContext, app));
}

export function getDeleteForeverFileMutationOptions(weavyContext: WeavyContext, app: AppType) {
  const queryClient = weavyContext.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationKey: filesKey,
    mutationFn: async ({ file }: MutateFileVariables) => {
      if (file.id >= 1 && file.is_trashed) {
        const response = await weavyContext.post("/api/files/" + file.id, "DELETE", "");
        if (!response.ok) {
          const serverError = <ServerErrorResponseType>await response.json();
          throw new Error(serverError.detail || serverError.title, { cause: serverError });
        }
      } else {
        const serverError = <ServerErrorResponseType>{ status: 400, title: `Could not delete ${file.name} forever.` };
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
    },
    onMutate: async (variables: MutateFileVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { status: "pending" })
      );
      return <FileMutationContextType>{ type: "delete-forever", file: variables.file, status: { state: "pending" } };
    },
    onSuccess: (_data: void, variables: MutateFileVariables) => {
      removeCacheItems(queryClient, { queryKey: options.mutationKey, exact: false }, variables.file.id);
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
      });
    },
    onError(error: Error, variables: MutateFileVariables) {
      // Show in error list instead?
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { status: undefined })
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "error";
        (context as FileMutationContextType).status.text = error.message;
      });
    },
  };

  return options;
}

export function getDeleteForeverFileMutation(
  weavyContext: WeavyContext,
  app: AppType
): DeleteForeverFileMutationType {
  return new MutationObserver(weavyContext.queryClient, getDeleteForeverFileMutationOptions(weavyContext, app));
}
