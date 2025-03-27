import { type WeavyType } from "../client/weavy";
import type { BlobType, ExternalBlobType, FileMutationContextType } from "../types/files.types";
import type { ServerErrorResponseType } from "../types/server.types";
import type { AppType } from "../types/app.types";
import type { UserType } from "../types/users.types";
import { type MutationKey, MutationObserver } from "@tanstack/query-core";
import { getTempFile } from "./file-create";
import { updateMutationContext } from "../utils/mutation-cache";

export type MutateExternalBlobVariables = {
  externalBlob: ExternalBlobType;
};

export type ExternalBlobMutationType = MutationObserver<
  BlobType,
  Error,
  MutateExternalBlobVariables,
  FileMutationContextType
>;

/*export function removeSuccessfulExternalBlobMutations(weavy: WeavyType, app: AppType, name: string) {
  const queryClient = weavy.queryClient;

  // Remove successful blobs
  queryClient
    .getMutationCache()
    .findAll({
      mutationKey: ["apps", app.id, "blobs", "external"],
      exact: true,
      status: "success",
      predicate: (mutation) => mutation.state.data.name === name,
    })
    .forEach((mutation) => {
      queryClient.getMutationCache().remove(mutation);
    });
}*/

export async function externalBlob(weavy: WeavyType, externalBlob: ExternalBlobType) {
  const response = await weavy.fetch("/api/blobs/external", { method: "POST", body: JSON.stringify(externalBlob) });

  if (!response.ok) {
    const serverError = <ServerErrorResponseType>await response.json();
    throw new Error(serverError.detail || serverError.title, { cause: serverError });
  }
  const blob: BlobType = await response.json();
  return blob;
}

export function getExternalBlobMutationOptions(weavy: WeavyType, user: UserType, appId: AppType["id"], uniqueId?: string) {
  const queryClient = weavy.queryClient;
  const blobsKey: MutationKey = ["apps", appId, "blobs", uniqueId];

  const options = {
    mutationFn: async (variables: MutateExternalBlobVariables) => {
      const uploadedFile = await externalBlob(weavy, variables.externalBlob);

      /*// Needed to be able to use the blob on errors?
        setMutationContext(weavy.queryClient, mutationKey, variables, (context) => {
            context.blob = uploadedFile;
        })*/

      return uploadedFile;
    },
    mutationKey: blobsKey,
    onMutate: async (variables: MutateExternalBlobVariables) => {
      await queryClient.cancelQueries({ queryKey: blobsKey, exact: true });

      const file = getTempFile(undefined, variables.externalBlob.name, variables.externalBlob.size, undefined, user);

      return <FileMutationContextType>{ type: "attach", file, status: { state: "pending" } };
    },
    onSuccess: (
      _data: BlobType,
      variables: MutateExternalBlobVariables,
      _context: FileMutationContextType | undefined
    ) => {
      updateMutationContext(queryClient, blobsKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
        (context as FileMutationContextType).status.progress = undefined;
        (context as FileMutationContextType).status.text = undefined;
      });
    },
    onError(error: Error, variables: MutateExternalBlobVariables, _context: FileMutationContextType | undefined) {
      const serverError = error.cause as ServerErrorResponseType;
      if (serverError && serverError.status === 409) {
        updateMutationContext(queryClient, blobsKey, variables, (context) => {
          (context as FileMutationContextType).status.state = "conflict";
          (context as FileMutationContextType).status.progress = undefined;
          (context as FileMutationContextType).status.text = serverError.detail || serverError.title;
        });
      } else {
        updateMutationContext(queryClient, blobsKey, variables, (context) => {
          if (context) {
            (context as FileMutationContextType).status.state = "error";
            (context as FileMutationContextType).status.progress = undefined;
            (context as FileMutationContextType).status.text = serverError.detail || serverError.title;
          }
        });
      }
    },
  };

  return options;
}

export function getExternalBlobMutation(
  weavy: WeavyType,
  user: UserType,
  appId: AppType["id"],
  uniqueId?: string
): ExternalBlobMutationType {
  return new MutationObserver(weavy.queryClient, getExternalBlobMutationOptions(weavy, user, appId, uniqueId));
}
