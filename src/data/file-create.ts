import { MutationKey, MutationState } from "@tanstack/query-core";
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
import { type WeavyContext } from "../client/weavy-context";
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
    refId: refId,
    name: name,
    kind: getKind(name),
    size: size,
    media_type: type,
    embed_url: "",
    preview_format: getWebPreviewFormat(name),
    thumbnail_url: srcUrl,
    preview_url: srcUrl,
    download_url: srcUrl,
    version: -1,
    created_by: user,
    created_by_id: user.id,
    created_at: new Date().toUTCString(),
    is_subscribed: false,
    is_trashed: false,
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
              loaded: combinedProgress.loaded + mutationState.context.status.progress * file.size,
              total: combinedProgress.total + file.size,
            };
          }
          return combinedProgress;
        },
        { loaded: 0, total: 0 }
      )
    : { loaded: 0, total: 0 };

  return {
    loaded: progress.loaded,
    total: progress.total,
    percent: progress.total > 0 ? progress.loaded / progress.total : null,
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

export function getFileMutationsByConflictOrError(
  mutationStates?: MutationState<BlobType | FileType, Error, unknown, FileMutationContextType>[]
) {
  return (
    mutationStates?.filter(
      (mutationState) =>{
        //console.log("mutationState", mutationState.context?.status.state, mutationState.status)
        return mutationState.context?.status.state === "conflict" || mutationState.status === "error"
      }
    ) || []
  );
}

/*export function useRemoveMutatingFileUpload(weavyContext: WeavyContext, filesKey: MutationKey) {
    const queryClient = weavyContext.queryClient;
    const mutationKey: MutationKey = filesKey;

    return (mutation: FileMutationType) => {
        if (queryClient.getMutationCache().find({ mutationKey: mutationKey, predicate: (m) => m === mutation })) {
            queryClient.getMutationCache().remove(mutation); 
        }
    }
}*/

/*export function useClearMutatingFileUpload(weavyContext: WeavyContext, filesKey: MutationKey) {
    const queryClient = weavyContext.queryClient;
    const mutationKey: MutationKey = filesKey;

    return () => {
        const mutations = queryClient.getMutationCache().findAll({ mutationKey: mutationKey });
        mutations.forEach((mutation: Mutation) => {
            queryClient.getMutationCache().remove(mutation); 
        });
        
    }
}*/

export function removeSettledFileMutations(weavyContext: WeavyContext, app: AppType, name: string) {
  const queryClient = weavyContext.queryClient;

  // Remove any file create mutations
  queryClient
    .getMutationCache()
    .findAll({
      mutationKey: ["apps", app.id, "files"],
      exact: true,
      predicate: (mutation) =>
        /error|success/.test(mutation.state.status) && mutation.state.variables.blob?.name === name,
    })
    .forEach((mutation) => {
      queryClient.getMutationCache().remove(mutation);
    });
}

/// Mutation for adding a <BlobType> to a <FileType> query
export function getCreateFileMutationOptions(weavyContext: WeavyContext, user: UserType, app: AppType) {
  const queryClient = weavyContext.queryClient;
  const filesKey: MutationKey = ["apps", app.id, "files"];

  const options = {
    mutationFn: async ({ blob, replace = false }: CreateFileProps) => {
      const response = await weavyContext.post(
        "/api/apps/" + app.id + "/files",
        "POST",
        JSON.stringify({ blob_id: blob.id, replace: replace })
      );

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
      removeSuccessfulUploadBlobMutations(weavyContext, app, variables.blob.name);
      removeSettledFileMutations(weavyContext, app, variables.blob.name);

      //let files = queryClient.getQueryData<InfiniteData<FilesResultType>>(filesKey);
      /*let file =  findAnyExistingItem<FileType>(files, "name", variables.blob.name, true) || variables.file;

            if (!file) {
                // If non existing add optimistic update
                const meta = queryClient.getQueryCache().find<FilesResultType>({ queryKey: filesKey})!.meta;
                const order = meta!.order as FileOrderType;
                */

      let srcUrl: URL | undefined;
      try {
        srcUrl = (variables.blob.thumbnail_url && new URL(variables.blob.thumbnail_url)) || undefined;
      } catch (e) {
        // no worries
      }

      const file = getTempFile(srcUrl, variables.blob.name, variables.blob.size, variables.blob.media_type, user);
      /*addCacheItem(queryClient, filesKey, file, file.id, order);
            } else {
                updateCacheItem(queryClient, filesKey, file?.refId || file?.id, (file: FileType) => Object.assign(file, { status: "pending" }));
            }*/

      return <FileMutationContextType>{
        type: variables.replace ? "replace" : "create",
        file,
        status: { state: "pending" },
      };
    },
    onSuccess: (_data: FileType, variables: CreateFileProps, _context: FileMutationContextType | undefined) => {
      //updateCacheItem(queryClient, filesKey, context!.file?.refId || context!.file?.id, (file: FileType) => Object.assign(file, data, { status: "ok", statusText: undefined, progress: undefined }));
      updateMutationContext(queryClient, filesKey, variables, (context) => {
        if (context) {
          (context as FileMutationContextType).status.state = "ok";
          (context as FileMutationContextType).status.progress = undefined;
          (context as FileMutationContextType).status.text = undefined;
        }
      });
      //console.log("FILE SUCCESS");
      return queryClient.invalidateQueries({ queryKey: filesKey });
    },
    onError(error: Error, variables: CreateFileProps, context: FileMutationContextType | undefined) {
      if ((error?.cause as ServerErrorResponseType)?.status === 409) {
        //updateCacheItem(queryClient, filesKey, context!.file?.refId || context!.file?.id, (file: FileType) => Object.assign(file, { status: "conflict", statusText: error.detail || error.title, progress: undefined }));
        updateMutationContext(queryClient, filesKey, variables, (context) => {
          if (context) {
            (context as FileMutationContextType).status.progress = undefined;
            (context as FileMutationContextType).status.state = "conflict";
            (context as FileMutationContextType).status.text = error.message;
          }
        });
      } else {
        const errorId = context!.file?.refId || context!.file?.id;
        if (errorId) {
          if (errorId >= 1) {
            //updateCacheItem(queryClient, filesKey, errorId, (file: FileType) => Object.assign(file, { status: "error", statusText: error.detail || error.title, progress: undefined }));
          } else if (errorId > 0 && errorId < 1) {
            //removeCacheItem(queryClient, mutationKey, errorId);
          }
        }
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
