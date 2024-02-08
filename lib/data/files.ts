import { QueryFunctionContext, QueryKey, InfiniteQueryObserverOptions, InfiniteData } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import { FileOrderType, FilesResultType } from "../types/files.types";
//import { addToQueryData, findAnyExistingItem, updateQueryData } from "../utils/query-cache";

/// GET all posts in an app
export function getInfiniteFileListOptions(
  weavyContext: WeavyContext,
  appId: number | null,
  filters: { order?: FileOrderType; trashed?: boolean } = {},
  options: Object = {}
): InfiniteQueryObserverOptions<FilesResultType, Error, InfiniteData<FilesResultType>> {
  const PAGE_SIZE = 25;

  if (!weavyContext) {
    throw new Error("useFileList must be used within a WeavyContext");
  }

  const filesKey = ["apps", appId, "files", filters];

  return {
    ...options,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: filesKey,
    initialPageParam: 0,
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const skip = opt.pageParam;
      const trashed: boolean = !!filters?.trashed;
      const orderParam = filters.order ? filters.order.by + (filters.order.descending ? "+desc" : "") : "";
      let url = "/api/apps/" + appId + "/files?skip=" + skip + "&top=" + PAGE_SIZE + "&orderby=" + orderParam;
      if (trashed) {
        url += "&trashed=null";
      }

      const response = await weavyContext.get(url);
      return await response.json();
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage?.end && lastPage?.end < lastPage?.count) {
        return pages.length * PAGE_SIZE;
      }
      return null;
    },
    /*select: (data: any) => {
        // UPDATE DATA WITH MUTATIONS
        // TODO: REMOVE?

        const mutatingFiles = queryClient.getMutationCache()
        .findAll({mutationKey: filesKey, predicate: (mutation: Mutation) => !!(<unknown>mutation as FileMutationType).state.context?.file})
        .map((mutation: Mutation) => (<unknown>mutation as FileMutationType).state.context!.file);
        
        const meta = queryClient.getQueryCache().find<FilesResultType>({ queryKey: filesKey })?.meta;
        const order = meta?.order as FileOrderType;
        
        mutatingFiles.forEach((file) => {
            //if (meta?.trashed === file.is_trashed) {
                if (file.id < 1 && file.status !== "ok" && file.status !== "error") {
                    let existingFile = findAnyExistingItem<FileType>(data, "name", file.name, true);
                    if (existingFile) {
                        file.id = existingFile.id;
                    }
                    data = addToQueryData(data, file, order);
                } else {
                    data = updateQueryData(data, file.id, (cacheFile: FileType) => { Object.assign(cacheFile, file)});
                }
            //}
        });
        return data;
    }*/
  };
}
