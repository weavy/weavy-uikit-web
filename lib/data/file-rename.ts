import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import type { FileMutationContextType, FileType } from "../types/files.types";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";
import { updateMutationContext } from "../utils/mutation-cache";
import type { AppType } from "../types/app.types";

export type MutateFileNameVariables = {
  file: FileType;
  name: string;
};

export type RenameFileMutationType = MutationObserver<
  FileType,
  Error,
  MutateFileNameVariables,
  FileMutationContextType
>;

export function getRenameFileMutationOptions(weavyContext: WeavyContext, app: AppType) {
  const queryClient = weavyContext.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationKey: filesKey,
    mutationFn: async ({ file, name }: MutateFileNameVariables): Promise<FileType> => {
      if (file.id >= 1) {
        const response = await weavyContext.post(
          "/api/files/" + file.id,
          "PATCH",
          JSON.stringify({
            name: name,
          })
        );

        if (!response.ok) {
          const serverError = <ServerErrorResponseType>await response.json();
          throw new Error(serverError.detail || serverError.title, { cause: serverError });
        }

        return response.json();
      } else {
        throw new Error(`Could not rename ${file.name}`);
      }
    },
    onMutate: (variables: MutateFileNameVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { name: variables.name })
      );
      return <FileMutationContextType>{ type: "rename", file: variables.file, status: { state: "pending" } };
    },
    onSuccess: (data: FileType, variables: MutateFileNameVariables) => {
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
    onError(error: Error, variables: MutateFileNameVariables) {
      // Show/update in mutation list also?
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { name: variables.file.name })
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "error";
        (context as FileMutationContextType).status.text = error.message;
      });
    },
  };

  return options;
}

export function getRenameFileMutation(weavyContext: WeavyContext, app: AppType): RenameFileMutationType {
  return new MutationObserver(weavyContext.queryClient, getRenameFileMutationOptions(weavyContext, app));
}
