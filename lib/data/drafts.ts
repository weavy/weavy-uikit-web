import { FetchQueryOptions, QueryObserverOptions } from "@tanstack/query-core";
import { WeavyType } from "../contexts/weavy-context";
import { EditorDraftType } from "../types/editor.types";
import { PlainObjectType } from "../types/generic.types";
import { UserType } from "../types/users.types";
import { FileType } from "../types/files.types";

export function getDraftOptions<T extends PlainObjectType = EditorDraftType>(
  weavy: WeavyType,
  draftKey: string,
  storage?: Storage,
) {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return <QueryObserverOptions<T>>{
    queryKey: ["draft", draftKey],
    queryFn: () => {
      if (storage) {
        const saved = storage.getItem(draftKey);
        if (saved) {
          return JSON.parse(saved) as T;
        }
      }

      return weavy.queryClient.getQueryData<T>(["draft", draftKey]) || null;
    },
    // Prevent it from refetching on window focus, etc.
    //staleTime: Infinity,
    cacheTime: Infinity,
  };
}

export async function getDraft<T extends PlainObjectType = EditorDraftType>(
  weavy: WeavyType,
  draftKey: string,
  noCache: boolean = false,
  storage?: Storage,
) {
  const queryClient = weavy.queryClient;
  const draftOptions = getDraftOptions<T>(weavy, draftKey, storage) as FetchQueryOptions<T>;

  if (noCache) {
    draftOptions.staleTime = 1;
    return await queryClient.fetchQuery<T>(draftOptions);
  } else {
    return await queryClient.ensureQueryData<T>(draftOptions);
  }
}

export function saveDraft<T extends PlainObjectType = EditorDraftType>(
  weavy: WeavyType,
  draftKey: string,
  draft: T,
  storage?: Storage,
) {
  const queryClient = weavy.queryClient;

  if (storage) {
    // Sync synchronously to local storage
    storage.setItem(draftKey, JSON.stringify(draft));
  }

  // Update the TanStack cache (triggers component re-renders)
  queryClient.setQueryData(["draft", draftKey], draft);
}

export function removeDraft(weavy: WeavyType, draftKey: string, storage?: Storage) {
  const queryClient = weavy.queryClient;

  if (storage) {
    // Sync synchronously to local storage
    storage.removeItem(draftKey);
  }

  const query = queryClient.getQueryData(["draft", draftKey])
  if (query) {
    // Update the TanStack cache (triggers component re-renders)
    void queryClient.resetQueries({ queryKey: ["draft", draftKey] });
  }
}

export function getFileDraftKey(file: FileType) {
  return `file-${file.id}`;
}

export function getFileDraftStorageKey(weavy: WeavyType, user: UserType, file: FileType) {
  return `${weavy.url}:draft-file-${file.id}-${user.id}`;
}
