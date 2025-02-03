import { QueryFunctionContext, QueryKey, InfiniteQueryObserverOptions, InfiniteData } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import { FileOrderType, FilesResultType } from "../types/files.types";
//import { addToQueryData, findAnyExistingItem, updateQueryData } from "../utils/query-cache";

/// GET all files in an app
export function getInfiniteFileListOptions(
  weavy: WeavyType,
  appId: number | null,
  filters: { order?: FileOrderType; trashed?: boolean } = {},
  options: object = {}
): InfiniteQueryObserverOptions<FilesResultType, Error, InfiniteData<FilesResultType>> {

  if (!weavy) {
    throw new Error("useFileList must be used within a WeavyContext");
  }

  const filesKey = ["apps", appId, "files", filters];

  return {
    ...options,
    queryKey: filesKey,
    initialPageParam: 0,
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const skip = opt.pageParam;
      const trashed: boolean = !!filters?.trashed;
      const orderParam = filters.order ? filters.order.by + (filters.order.descending ? "+desc" : "") : "";
      let url = "/api/apps/" + appId + "/files?skip=" + skip + "&order_by=" + orderParam;
      if (trashed) {
        url += "&trashed=null";
      }

      const response = await weavy.fetch(url);
      return await response.json();
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.end && lastPage.end < lastPage.count) {
        return lastPage.end;
      }
      return null;
    }
  };
}
