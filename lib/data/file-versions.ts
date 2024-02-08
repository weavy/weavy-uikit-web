import { type MutationKey, MutationObserver, type QueryKey } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import type { FileMutationContextType, FileType } from "../types/files.types";
import type { AppType } from "../types/app.types";
import { removeCacheItem, updateCacheItem, updateCacheItems } from "../utils/query-cache";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateMutationContext } from "../utils/mutation-cache";

export type MutateFileVersionVariables = {
  versionFile: FileType;
};

export type FileVersionMutationType = MutationObserver<
  FileType,
  Error,
  MutateFileVersionVariables,
  FileMutationContextType
>;
export type FileVersionDeleteMutationType = MutationObserver<void, Error, MutateFileVersionVariables, void>;

export function getFileVersionsKey(app: AppType, file: FileType): QueryKey {
  return ["apps", app.id, "file", file.id, "versions"];
}

export function getFileVersionRestoreMutationOptions(weavyContext: WeavyContext, app: AppType, file: FileType) {
  const queryClient = weavyContext.queryClient;

  const filesKey: MutationKey = ["apps", app.id, "files"];
  const fileVersionKey: QueryKey = getFileVersionsKey(app, file);

  const options = {
    mutationKey: filesKey,
    mutationFn: async ({ versionFile }: MutateFileVersionVariables) => {
      if (versionFile.id >= 1 && versionFile.version) {
        const response = await weavyContext.post(
          `/api/files/${versionFile.id}/versions/${versionFile.version}/restore`,
          "POST",
          ""
        );
        return response.json();
      } else {
        throw new Error(`Could not restore ${versionFile.name} to version ${versionFile.version}.`);
      }
    },
    onMutate: async (variables: MutateFileVersionVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.versionFile.id,
        (existingFile: FileType) => {
          return Object.assign(existingFile, variables.versionFile, { status: "pending" });
        }
      );
      return <FileMutationContextType>{ type: "version", file, status: { state: "pending" } };
    },
    onSuccess: (data: FileType, variables: MutateFileVersionVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.versionFile.id,
        (existingFile: FileType) => Object.assign(existingFile, data, { status: "ok" })
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
      });
    },
    onError(error: Error, variables: MutateFileVersionVariables, context: FileMutationContextType | undefined) {
      if (context?.file) {
        updateCacheItems(
          queryClient,
          { queryKey: options.mutationKey, exact: false },
          variables.versionFile.id,
          (existingFile: FileType) => Object.assign(existingFile, context.file, { status: "error" })
        );
      }
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "error";
        (context as FileMutationContextType).status.text = error.message;
      });
    },
    onSettled() {
      queryClient.invalidateQueries({ queryKey: fileVersionKey });
    },
  };

  return options;
}

export function getFileVersionRestoreMutation(
  weavyContext: WeavyContext,
  app: AppType,
  file: FileType
): FileVersionMutationType {
  return new MutationObserver(weavyContext.queryClient, getFileVersionRestoreMutationOptions(weavyContext, app, file));
}

export function getFileVersionDeleteMutationOptions(weavyContext: WeavyContext, app: AppType, file: FileType) {
  const queryClient = weavyContext.queryClient;

  const fileVersionKey: QueryKey = getFileVersionsKey(app, file);

  const options = {
    mutationKey: fileVersionKey,
    mutationFn: async ({ versionFile }: MutateFileVersionVariables) => {
      if (versionFile.id >= 1 && versionFile.version) {
        const response = await weavyContext.post(
          `/api/files/${versionFile.id}/versions/${versionFile.version}`,
          "DELETE",
          ""
        );
        if (!response.ok) {
          const serverError = <ServerErrorResponseType>await response.json();
          throw new Error(serverError.detail || serverError.title, { cause: serverError });
        }
      } else {
        const serverError = <ServerErrorResponseType>{
          status: 400,
          title: `Could not remove ${versionFile.name} version ${versionFile.version}.`,
        };
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }
    },
    onMutate: async (variables: MutateFileVersionVariables) => {
      const versionPredicate = (item: FileType) =>
        item.id === variables.versionFile.id && item.version === variables.versionFile.version;
      updateCacheItem(queryClient, fileVersionKey, versionPredicate, (existingFile: FileType) =>
        Object.assign(existingFile, { status: "pending" })
      );
    },
    onSuccess: (data: void, variables: MutateFileVersionVariables) => {
      const versionPredicate = (item: FileType) =>
        item.id === variables.versionFile.id && item.version === variables.versionFile.version;
      removeCacheItem(queryClient, fileVersionKey, versionPredicate);
    },
    onError(error: Error, variables: MutateFileVersionVariables) {
      // Show in error list instead?
      const versionPredicate = (item: FileType) =>
        item.id === variables.versionFile.id && item.version === variables.versionFile.version;
      updateCacheItem(queryClient, fileVersionKey, versionPredicate, (existingFile: FileType) =>
        Object.assign(existingFile, { status: undefined })
      );
    },
  };

  return options;
}

export function getFileVersionDeleteMutation(
  weavyContext: WeavyContext,
  app: AppType,
  file: FileType
): FileVersionDeleteMutationType {
  return new MutationObserver(weavyContext.queryClient, getFileVersionDeleteMutationOptions(weavyContext, app, file));
}
