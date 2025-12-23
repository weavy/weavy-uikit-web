import { BlobType, FileMutationContextType, MutateFileProps } from "../types/files.types";
import { type ServerErrorResponseType } from "../types/server.types";
import { type WeavyType } from "../client/weavy";
import { AppType } from "../types/app.types";
import { UserType } from "../types/users.types";
import { Mutation, MutationKey } from "@tanstack/query-core";
import { getTempFile } from "./file-create";
import { updateMutationContext } from "../utils/mutation-cache";
import { HeaderContentType } from "../types/http.types";
import { getHash } from "../utils/files";
import { MutationAbortProps } from "../types/query.types";

export type UploadBlobProps = {
  file: File;
  onProgress?: (variables: UploadProgressProps) => void;
};

export type UploadProgressProps = {
  /** Upload progress in percent 0-100 */
  progress: number;
};

export type UploadBlobMutationType = Mutation<BlobType, Error, MutateFileProps, FileMutationContextType | undefined>;

export function removeSuccessfulUploadBlobMutations(weavy: WeavyType, app: AppType, name: string, uniqueId?: string, type: "blobs" | "data" = "blobs") {
  const queryClient = weavy.queryClient;

  // Remove successful blobs
  queryClient
    .getMutationCache()
    .findAll({
      mutationKey: uniqueId ? ["apps", app.id, type, uniqueId] : ["apps", app.id, type],
      exact: true,
      status: "success",
      predicate: (mutation) => (mutation as UploadBlobMutationType).state.data?.name === name,
    })
    .forEach((mutation) => {
      queryClient.getMutationCache().remove(mutation);
    });
}

export async function uploadBlob(weavy: WeavyType, file: File, onProgress?: (variables: UploadProgressProps) => void, signal?: AbortSignal) {
  const formData = new FormData();
  formData.append("blob", file);

  const response = await weavy.upload("/api/blobs", "POST", formData, HeaderContentType.Auto, (progress) => {
    if (onProgress) {
      onProgress({ progress: progress });
    }
  },
  signal
  );

  if (!response.ok) {
    const serverError = <ServerErrorResponseType>await response.json();
    throw new Error(serverError.detail || serverError.title, { cause: serverError });
  }
  const blob = await response.json() as BlobType;
  return blob;
}

export function getSimpleUploadBlobMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async (variables: MutateFileProps) => {
      const uploadedFile = await uploadBlob(weavy, variables.file, variables.onProgress);
      return uploadedFile;
    },
    // TODO: implement onmutate, onsuccess, onerror...
  };

  return options;
}

export function getUploadBlobMutationOptions(weavy: WeavyType, user: UserType, appId: number | string, uniqueId?: string, type: "blobs" | "data" = "blobs") {
  const queryClient = weavy.queryClient;
  const blobsKey: MutationKey = uniqueId ? ["apps", appId, type, uniqueId] : ["apps", appId, type];

  const options = {
    mutationFn: async (variables: MutateFileProps & MutationAbortProps) => {
      const uploadedFile = await uploadBlob(weavy, variables.file, variables.onProgress, variables.signal);

      /*// Needed to be able to use the blob on errors?
            setMutationContext(weavy.queryClient, mutationKey, variables, (context) => {
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

      const sha256 = await getHash(variables.file);

      return <FileMutationContextType>{ type: "upload", file, status: { state: "pending" }, sha256 };
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
