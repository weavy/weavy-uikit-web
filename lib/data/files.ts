import { InfiniteQueryObserverOptions, InfiniteData } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import { FileOrderType, FilesResultType } from "../types/files.types";
import { QueryPagingAroundType } from "../types/query.types";
import { firstPageParam, initialPageParam, lastPageParam, queryPageParams } from "./api";
//import { addToQueryData, findAnyExistingItem, updateQueryData } from "../utils/query-cache";

export type FilesFilterType = { around?: number; order?: FileOrderType; trashed?: boolean };
export type FilesQueryKeyType = ["apps", number, "files", FilesFilterType];

/// GET bidirectional list of files in an app
export function getBidirectionalInfiniteFileListOptions(
  weavy: WeavyType,
  appId: number,
  filters: FilesFilterType = {},
  options: object = {},
): InfiniteQueryObserverOptions<
  FilesResultType,
  Error,
  InfiniteData<FilesResultType>  
> {
  if (!weavy) {
    throw new Error("getInfiniteAroundFileListOptions must be used within a WeavyContext");
  }

  const filesKey: FilesQueryKeyType = ["apps", appId, "files", filters];

  return {
    ...options,
    queryKey: filesKey,
    initialPageParam: initialPageParam(filters.around),
    queryFn: async (opt) => {
      const trashed: boolean = !!filters?.trashed;

      const queryParams = queryPageParams(opt.pageParam as QueryPagingAroundType);

      if (filters.order) {
        queryParams.set("order_by", filters.order.by + (filters.order.descending ? " desc" : ""));
      }

      if (trashed) {
        queryParams.set("trashed", "null");
      }

      const url = `/api/apps/${appId}/files?${queryParams.toString()}`;

      const response = await weavy.fetch(url);
      return (await response.json()) as FilesResultType;
    },
    getPreviousPageParam: firstPageParam(),
    getNextPageParam: lastPageParam(),
  };
}
