import { BlobType, FileMutationContextType, MutateFileProps } from "../types/files.types";
import { type ServerErrorResponseType } from "../types/server.types";
import { type WeavyContext } from "../client/weavy-context";
import { AppType } from "../types/app.types";
import { UserType } from "../types/users.types";
import { MutationKey } from "@tanstack/query-core";
import { getTempFile } from "./file-create";
import { updateMutationContext } from "../utils/mutation-cache";

export type UploadBlobProps = {
  file: File;
  onProgress?: (variables: UploadProgressProps) => void;
};

export type UploadProgressProps = {
  progress: number;
};

export function removeSuccessfulUploadBlobMutations(
  weavyContext: WeavyContext,
  app: AppType,
  name: string,
  uniqueId?: string
) {
  const queryClient = weavyContext.queryClient;

  // Remove successful blobs
  queryClient
    .getMutationCache()
    .findAll({
      mutationKey: ["apps", app.id, "blobs", uniqueId],
      exact: true,
      status: "success",
      predicate: (mutation) => mutation.state.data.name === name,
    })
    .forEach((mutation) => {
      queryClient.getMutationCache().remove(mutation);
    });
}

export async function uploadBlob(
  weavyContext: WeavyContext,
  file: File,
  onProgress?: (variables: UploadProgressProps) => void
) {
  const formData = new FormData();
  formData.append("blob", file);

  const response = await weavyContext.upload("/api/blobs", "POST", formData, "", (progress) => {
    if (onProgress) {
      onProgress({ progress: progress });
    }
  });

  if (!response.ok) {
    const serverError = <ServerErrorResponseType>await response.json();
    throw new Error(serverError.detail || serverError.title, { cause: serverError });
  }
  const blob: BlobType = await response.json();
  return blob;
}

export function getUploadBlobMutationOptions(
  weavyContext: WeavyContext,
  user: UserType,
  app: AppType,
  uniqueId?: string
) {
  const queryClient = weavyContext.queryClient;
  const blobsKey: MutationKey = ["apps", app.id, "blobs", uniqueId];

  const options = {
    mutationFn: async (variables: MutateFileProps) => {
      const uploadedFile = await uploadBlob(weavyContext, variables.file, variables.onProgress);

      /*// Needed to be able to use the blob on errors?
            setMutationContext(weavyContext.queryClient, mutationKey, variables, (context) => {
                context.blob = uploadedFile;
            })*/

      return uploadedFile;
    },
    mutationKey: blobsKey,
    onMutate: async (variables: MutateFileProps) => {
      await queryClient.cancelQueries({ queryKey: blobsKey, exact: true });

      const file = getTempFile(variables.file, variables.file.name, variables.file.size, variables.file.type, user);

      variables.onProgress = ({ progress }) => {
        updateMutationContext(queryClient, blobsKey, variables, (context) => {
          (context as FileMutationContextType).status.state = "pending";
          (context as FileMutationContextType).status.progress = progress;
        });
      };

      return <FileMutationContextType>{ type: "upload", file, status: { state: "pending" } };
    },
    onSuccess: (_data: BlobType, variables: MutateFileProps, _context: FileMutationContextType | undefined) => {
      updateMutationContext(queryClient, blobsKey, variables, (context) => {
        (context as FileMutationContextType).status.state = "ok";
        (context as FileMutationContextType).status.progress = undefined;
        (context as FileMutationContextType).status.text = undefined;
      });
    },
    onError(error: Error, variables: MutateFileProps, _context: FileMutationContextType | undefined) {
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
