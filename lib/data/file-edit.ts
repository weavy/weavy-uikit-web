import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { BlobType, FileMutationContextType, FileType } from "../types/files.types";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";
import { updateMutationContext } from "../utils/mutation-cache";
import type { AppType } from "../types/app.types";

export type MutateFileNameVariables = {
  file: FileType;
  name: string;
};

export type MutateFileBlobVariables = {
  file: FileType;
  blob: BlobType;
};

export type RenameFileMutationType = MutationObserver<
  FileType,
  Error,
  MutateFileNameVariables,
  FileMutationContextType
>;

export function getRenameFileMutationOptions(weavy: WeavyType, app: AppType) {
  const queryClient = weavy.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationKey: filesKey,
    mutationFn: async ({ file, name }: MutateFileNameVariables): Promise<FileType> => {
      if (file.id >= 1) {
        const response = await weavy.fetch("/api/files/" + file.id, {
          method: "PATCH",
          body: JSON.stringify({
            name: name,
          }),
        });

        if (!response.ok) {
          const serverError = <ServerErrorResponseType>await response.json();
          throw new Error(serverError.detail || serverError.title, { cause: serverError });
        }

        return (await response.json()) as FileType;
      } else {
        throw new Error(`Could not rename file ${file.id}`);
      }
    },
    onMutate: (variables: MutateFileNameVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, { name: variables.name }),
      );
      queryClient.setQueryData(
        ["app", app.id, "file", variables.file.id],
        (existingFile: FileType) => existingFile && Object.assign(existingFile, { name: variables.name }),
      );
      return <FileMutationContextType>{ type: "rename", file: variables.file, status: { state: "pending" } };
    },
    onSuccess: (data: FileType, variables: MutateFileNameVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, data),
      );
      queryClient.setQueryData(
        ["app", app.id, "file", variables.file.id],
        (existingFile: FileType) => existingFile && Object.assign(existingFile, data),
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
      });
    },
    onError: (error: Error, variables: MutateFileNameVariables) => {
      // Show/update in mutation list also?
      void queryClient.invalidateQueries({ queryKey: options.mutationKey, exact: false });
      void queryClient.invalidateQueries({ queryKey: ["app", app.id, "file", variables.file.id] });

      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "error";
        (context as FileMutationContextType).status.text = error.message;
      });
    },
  };

  return options;
}

export function getRenameFileMutation(
  weavy: WeavyType,
  app: AppType,
): MutationObserver<FileType, Error, MutateFileNameVariables, FileMutationContextType> {
  return new MutationObserver(weavy.queryClient, getRenameFileMutationOptions(weavy, app));
}

export function getUpdateFileMutationOptions(weavy: WeavyType, app: AppType) {
  const queryClient = weavy.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationKey: filesKey,
    mutationFn: async ({ file, blob }: MutateFileBlobVariables): Promise<FileType> => {
      if (file.id >= 1) {
        const response = await weavy.fetch("/api/files/" + file.id, {
          method: "PATCH",
          body: JSON.stringify({
            blob_id: blob.id,
            backup: true,
          }),
        });

        if (!response.ok) {
          const serverError = <ServerErrorResponseType>await response.json();
          throw new Error(serverError.detail || serverError.title, { cause: serverError });
        }

        return (await response.json()) as FileType;
      } else {
        throw new Error(`Could not update ${file.name}`);
      }
    },
    onMutate: (variables: MutateFileBlobVariables) => {
      return <FileMutationContextType>{ type: "edit", file: variables.file, status: { state: "pending" } };
    },
    onSuccess: (data: FileType, variables: MutateFileBlobVariables) => {
      updateCacheItems(
        queryClient,
        { queryKey: options.mutationKey, exact: false },
        variables.file.id,
        (existingFile: FileType) => Object.assign(existingFile, data),
      );
      queryClient.setQueryData(
        ["app", app.id, "file", variables.file.id],
        (existingFile: FileType | undefined) => existingFile && { ...existingFile, ...data },
      );
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
      });
    },
    onError: (error: Error, variables: MutateFileBlobVariables) => {
      updateMutationContext(queryClient, options.mutationKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "error";
        (context as FileMutationContextType).status.text = error.message;
      });
    },
  };

  return options;
}

export function getUpdateFileMutation(
  weavy: WeavyType,
  app: AppType,
): MutationObserver<FileType, Error, MutateFileBlobVariables, FileMutationContextType> {
  return new MutationObserver(weavy.queryClient, getUpdateFileMutationOptions(weavy, app));
}
