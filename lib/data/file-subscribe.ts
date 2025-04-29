import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { FileMutationContextType, FileType } from "../types/files.types";
import type { ServerErrorResponseType } from "../types/server.types";
import { updateCacheItems } from "../utils/query-cache";
import { updateMutationContext } from "../utils/mutation-cache";
import { AppType } from "../types/app.types";

export type MutateFileSubscribeVariables = {
  file: FileType;
  subscribe: boolean;
};

export type SubscribeFileMutationType = MutationObserver<
  void,
  Error,
  MutateFileSubscribeVariables,
  FileMutationContextType
>;

export function getSubscribeFileMutationOptions(weavy: WeavyType, app: AppType) {
  const queryClient = weavy.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationKey: filesKey,
    mutationFn: async ({ file, subscribe }: MutateFileSubscribeVariables) => {
      if (file.id >= 1) {
        const response = await weavy.fetch(`/api/files/${file.id}/${subscribe ? "subscribe" : "unsubscribe"}`, {
          method: "POST",
        });
        if (!response.ok) {
          const serverError = <ServerErrorResponseType>await response.json();
          throw new Error(serverError.detail || serverError.title, { cause: serverError });
        }
      } else {
        throw new Error(`Could not ${subscribe ? "subscribe" : "unsubscribe"} to ${file.name}.`);
      }
    },
    onMutate: (variables: MutateFileSubscribeVariables) => {
      updateCacheItems(queryClient, { queryKey: filesKey, exact: false }, variables.file.id, (existingFile: FileType) =>
        Object.assign(existingFile, { is_subscribed: variables.subscribe, status: "pending" })
      );
      return <FileMutationContextType>{
        type: variables.subscribe ? "subscribe" : "unsubscribe",
        file: variables.file,
        status: { state: "pending" },
      };
    },
    onSuccess: (data: void, variables: MutateFileSubscribeVariables) => {
      updateCacheItems(queryClient, { queryKey: filesKey, exact: false }, variables.file.id, (existingFile: FileType) =>
        Object.assign(existingFile, { status: "ok" })
      );
      updateMutationContext(queryClient, filesKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
      });
    },
    onError: (error: Error, variables: MutateFileSubscribeVariables) => {
      updateCacheItems(queryClient, { queryKey: filesKey, exact: false }, variables.file.id, (existingFile: FileType) =>
        Object.assign(existingFile, { is_subscribed: variables.file.is_subscribed, status: "error" })
      );
      updateMutationContext(queryClient, filesKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "error";
        (context as FileMutationContextType).status.text = error.message;
      });
    },
  };

  return options;
}

export function getSubscribeFileMutation(weavy: WeavyType, app: AppType): SubscribeFileMutationType {
  return new MutationObserver(weavy.queryClient, getSubscribeFileMutationOptions(weavy, app));
}
