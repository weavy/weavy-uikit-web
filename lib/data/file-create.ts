import { Mutation, MutationKey, MutationState } from "@tanstack/query-core";
import { getKind, getWebPreviewFormat } from "../utils/files";
import {
  BlobType,
  FileType,
  CreateFileProps,
  FileMutationContextType,
  FileStatusStateType,
} from "../types/files.types";
import { UserType } from "../types/users.types";
import { type ServerErrorResponseType } from "../types/server.types";
import { type WeavyType } from "../client/weavy";
import { AppType } from "../types/app.types";
import { removeSuccessfulUploadBlobMutations } from "./blob-upload";
import { updateMutationContext } from "../utils/mutation-cache";

export const getTempFile = (
  file: File | URL | undefined,
  name: string,
  size: number = 0,
  type: string = "application/octet-stream",
  user: UserType,
  refId: number = Date.now()
) => {
  const srcUrl = file && (file instanceof URL ? file.toString() : URL.createObjectURL(file));
  const tempFile: FileType = {
    id: refId,
    app: { id: -1 },
    name: name,
    kind: getKind(name),
    size: size,
    media_type: type,
    embed_url: "",
    preview_format: getWebPreviewFormat(name),
    thumbnail_url: srcUrl,
    preview_url: srcUrl,
    download_url: srcUrl,
    rev: -1,
    created_by: user,
    created_at: new Date().toUTCString(),
    is_subscribed: false,
    is_trashed: false,
    is_starred: false,
  };
  return tempFile;
};

export function getFileMutationsTotalProgress(
  mutationStates?: MutationState<BlobType, unknown, unknown, FileMutationContextType>[]
) {
  const progress = mutationStates
    ? mutationStates.reduce(
        (combinedProgress, mutationState) => {
          const file = mutationState.context?.file as FileType;
          if (file && mutationState.context?.status.progress && file.size) {
            return {
              loaded: combinedProgress.loaded + Math.floor((mutationState.context.status.progress / 100) * file.size),
              total: combinedProgress.total + file.size,
            };
          }
          return combinedProgress;
        },
        { loaded: 0, total: 0 }
      )
    : { loaded: 0, total: 0 };

  return {
    /** Loaded bytes */
    loaded: progress.loaded,
    /** Total bytes */
    total: progress.total,
    /** Progress of upload provided as 0-100 percent. */
    percent: progress.total > 0 ? progress.loaded / progress.total * 100 : null,
  };
}

export function getFileMutationsTotalStatus(
  mutationStates?: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>[]
): FileStatusStateType {
  return mutationStates
    ? mutationStates.some((mutationState) => mutationState.context?.status.state === "conflict")
      ? "conflict"
      : mutationStates.some((mutationState) => mutationState.status === "error")
      ? "error"
      : mutationStates.every((mutationState) => mutationState.status === "success")
      ? "ok"
      : "pending"
    : "ok";
}

export function getPendingFileMutations(
  mutationStates?: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>[]
) {
  return (
    mutationStates?.filter((mutationState) => {
      return mutationState.context?.status.state === "pending";
    }) || []
  );
}

export function getFileMutationsByConflictOrError(
  mutationStates?: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>[]
) {
  return (
    mutationStates?.filter((mutationState) => {
      //console.log("mutationState", mutationState.context?.status.state, mutationState.status)
      return mutationState.context?.status.state === "conflict" || mutationState.status === "error";
    }) || []
  );
}

export type CreateFileMutationType = Mutation<FileType, Error, CreateFileProps, FileMutationContextType | undefined>;

export function removeErroredFileMutations(weavy: WeavyType, app: AppType) {
  const queryClient = weavy.queryClient;

  // remove any file create mutations
  queryClient
    .getMutationCache()
    .findAll({
      mutationKey: ["apps", app.id, "blobs"],
      exact: true,
    })
    .forEach((mutation) => {
      if ((mutation.state.context as FileMutationContextType)?.status.state === "error") {
        queryClient.getMutationCache().remove(mutation);
      }
    });

  // remove any file create mutations
  queryClient
    .getMutationCache()
    .findAll({
      mutationKey: ["apps", app.id, "files"],
      exact: true,
    })
    .forEach((mutation) => {
      if ((mutation.state.context as FileMutationContextType)?.status.state === "conflict") {
        queryClient.getMutationCache().remove(mutation);
      }
    });
}

export function removeSettledFileMutations(weavy: WeavyType, app: AppType, name?: string) {
  const queryClient = weavy.queryClient;

  // Remove blob mutations
  queryClient
    .getMutationCache()
    .findAll({
      mutationKey: ["apps", app.id, "blobs"],
      exact: true,
      predicate: (mutation) =>
        /error|success/.test(mutation.state.status) &&
        (!name || (mutation as CreateFileMutationType).state.variables?.blob?.name === name),
    })
    .forEach((mutation) => {
      queryClient.getMutationCache().remove(mutation);
    });

  // Remove any file create mutations
  // Optionally only by name
  queryClient
    .getMutationCache()
    .findAll({
      mutationKey: ["apps", app.id, "files"],
      exact: true,
      predicate: (mutation) =>
        /error|success/.test(mutation.state.status) &&
        (!name || (mutation as CreateFileMutationType).state.variables?.blob?.name === name),
    })
    .forEach((mutation) => {
      queryClient.getMutationCache().remove(mutation);
    });
}

/// Mutation for adding a <BlobType> to a <FileType> query
export function getCreateFileMutationOptions(weavy: WeavyType, user: UserType, app: AppType) {
  const queryClient = weavy.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationFn: async ({ blob, replace = false }: CreateFileProps) => {
      const response = await weavy.fetch("/api/apps/" + app.id + "/files", {
        method: "POST",
        body: JSON.stringify({ blob_id: blob.id, replace: replace }),
      });

      if (!response.ok) {
        const serverError = <ServerErrorResponseType>await response.json();
        throw new Error(serverError.detail || serverError.title, { cause: serverError });
      }

      return <FileType>await response.json();
    },
    mutationKey: filesKey,
    onMutate: async (variables: CreateFileProps) => {
      await queryClient.cancelQueries({ queryKey: filesKey, exact: true });

      // Remove previous mutations
      removeSuccessfulUploadBlobMutations(weavy, app, variables.blob.name);
      removeSettledFileMutations(weavy, app, variables.blob.name);

      let srcUrl: URL | undefined;
      try {
        srcUrl = (variables.blob.thumbnail_url && new URL(variables.blob.thumbnail_url)) || undefined;
      } catch {
        // no worries
      }

      const file = getTempFile(srcUrl, variables.blob.name, variables.blob.size, variables.blob.media_type, user);

      return <FileMutationContextType>{
        type: variables.replace ? "replace" : "create",
        file,
        status: { state: "pending" },
      };
    },
    onSuccess: (_data: FileType, variables: CreateFileProps, _context: FileMutationContextType | undefined) => {
      updateMutationContext(queryClient, filesKey, variables, (context) => {
        if (context) {
          (context as FileMutationContextType).status.state = "ok";
          (context as FileMutationContextType).status.progress = undefined;
          (context as FileMutationContextType).status.text = undefined;
        }
      });
      return queryClient.invalidateQueries({ queryKey: filesKey });
    },
    onError(error: Error, variables: CreateFileProps, _context: FileMutationContextType | undefined) {
      if ((error?.cause as ServerErrorResponseType)?.status === 409) {
        updateMutationContext(queryClient, filesKey, variables, (context) => {
          if (context) {
            (context as FileMutationContextType).status.progress = undefined;
            (context as FileMutationContextType).status.state = "conflict";
            (context as FileMutationContextType).status.text = error.message;
          }
        });
      } else {
        updateMutationContext(queryClient, filesKey, variables, (context) => {
          if (context) {
            (context as FileMutationContextType).status.state = "error";
            (context as FileMutationContextType).status.progress = undefined;
            (context as FileMutationContextType).status.text = error.message;
          }
        });
      }
    },
  };

  return options;
}
