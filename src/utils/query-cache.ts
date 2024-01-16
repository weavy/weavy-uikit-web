import { InfiniteData, NoInfer, QueryClient, QueryFilters, QueryKey, SetDataOptions } from "@tanstack/query-core";
import { PlainObjectType } from "src/types/generic.types";
import { InfiniteQueryResultType, QueryResultType } from "src/types/query.types";

// export const getCacheItem = <T>(queryClient: QueryClient, key: QueryKey, id: number): T | null => {

//     const data = queryClient.getQueryData<any>(key);
//     if (data) {
//         if (data.pages) {
//             const items = data.pages.map((p: any) => p.data).flat();
//             return items.find((i: any) => i.id === id)
//         } else {
//             // not paged data...
//         }
//     }

//     return null;
// }

export function findAnyExistingItem<TDataItem>(
  queryData: InfiniteData<InfiniteQueryResultType<TDataItem>> | QueryResultType<TDataItem> | undefined,
  propertyName: string,
  value: string,
  copy = false
) {
  let existingItem: TDataItem | undefined;
  // Find any existing item with same property value
  if (queryData) {
    if ((queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pages) {
      (queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pages.some((page) => {
        return page?.data?.some((item) => {
          if (item[propertyName] === value) {
            existingItem = item;
            return true;
          }
          return false;
        });
      });
    } else if ((queryData as QueryResultType<TDataItem>).length) {
      return (queryData as QueryResultType<TDataItem>).some((item) => {
        if (item[propertyName] === value) {
          existingItem = item;
          return true;
        }
        return false;
      });
    }
  }

  return existingItem && copy ? <TDataItem>{ ...existingItem } : existingItem;
}

export function addToQueryData<TDataItem>(
  queryData: InfiniteData<InfiniteQueryResultType<TDataItem>> | QueryResultType<TDataItem> | undefined,
  item: TDataItem,
  sorting: { by?: string; descending?: boolean } = {},
  tempId?: number
) {
  if (queryData) {
    // True immutable copy
    queryData = JSON.parse(JSON.stringify(queryData));

    if ((queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>)?.pages) {
      let foundIndex = -1;

      const newPagesArray =
        (queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pages.map((page, i) => {
          if (foundIndex >= 0) {
            return page;
          }

          const pageData = page.data || [];

          // remove any previous item or tempId
          const newData = pageData.filter((pageItem) => pageItem.id !== (item as TDataItem & PlainObjectType).id && (!tempId || pageItem.id !== tempId));

          if (sorting && sorting.by) {
            // Use sorting
            foundIndex = newData.findIndex((pageItem) => {
              let pageItemValue = pageItem[sorting.by!];
              let itemValue = (item as TDataItem & PlainObjectType)[sorting.by!];

              // modified_at should fallback to created_at
              if (sorting.by === "modified_at") {
                pageItemValue ??= pageItem["created_at"];
                itemValue ??= (item as TDataItem & PlainObjectType)["created_at"];
              }

              if (typeof pageItemValue === "string" && typeof itemValue === "string") {
                const sortCompare = pageItemValue.localeCompare(itemValue, undefined, {
                  sensitivity: "base",
                  numeric: true,
                });
                return sorting.descending ? sortCompare < 0 : sortCompare > 0;
              }

              return (
                pageItemValue &&
                itemValue &&
                (sorting.descending ? pageItemValue < itemValue : pageItemValue > itemValue)
              );
            });

            if (foundIndex >= 0) {
              newData.splice(foundIndex, 0, (item as TDataItem & PlainObjectType));
              page.data = [...newData];
              if (page.end) {
                page.end += 1 + newData.length - pageData.length;
              }
            } else if (
              queryData &&
              i == (queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pages.length - 1 &&
              page.end === page.count
            ) {
              // end of the list
              page.data = [...newData, (item as TDataItem & PlainObjectType)];

              if (page.end) {
                page.end += 1 + newData.length - pageData.length;
              }
            } else {
              page.data = [...newData];
            }
          } else {
            // add new item to first page
            if (i === 0) {
              if (sorting.descending) {
                page.data = [(item as TDataItem & PlainObjectType), ...newData];
              } else {
                page.data = [...newData, (item as TDataItem & PlainObjectType)];
              }

              if (page.end) {
                page.end += 1 + newData.length - pageData.length;
              }
            }
          }

          return page;
        }) ?? [];

      return {
        pages: [...newPagesArray],
        pageParams: [...(queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pageParams],
      };
    } else if ((queryData as QueryResultType<TDataItem>)?.length) {
      // not paged data...
      let foundIndex = -1;
      // remove any previous item or tempId
      const newData = [
        ...(queryData as QueryResultType<TDataItem>).filter(
          (dataItem) => dataItem.id !== (item as TDataItem & PlainObjectType).id && (!tempId || dataItem.id !== tempId)
        ),
      ];

      if (sorting && sorting.by) {
        // Use sorting
        foundIndex = newData.findIndex((dataItem) => {
          let dataItemValue = dataItem[sorting.by!];
          let itemValue = (item as TDataItem & PlainObjectType)[sorting.by!];

          // modified_at should fallback to created_at
          if (sorting.by === "modified_at") {
            dataItemValue ??= dataItem["created_at"];
            itemValue ??= (item as TDataItem & PlainObjectType)["created_at"];
          }

          if (typeof dataItemValue === "string" && typeof itemValue === "string") {
            const sortCompare = dataItemValue.localeCompare(itemValue, undefined, {
              sensitivity: "base",
              numeric: true,
            });
            return sorting.descending ? sortCompare < 0 : sortCompare > 0;
          }

          return (
            dataItemValue && itemValue && (sorting.descending ? dataItemValue < itemValue : dataItemValue > itemValue)
          );
        });

        if (foundIndex >= 0) {
          newData.splice(foundIndex, 0, (item as TDataItem & PlainObjectType));
        } else {
          // end of the list
          newData.push((item as TDataItem & PlainObjectType));
        }
      } else {
        // no specific sorting
        if (sorting.descending) {
          newData.unshift((item as TDataItem & PlainObjectType));
        } else {
          newData.push((item as TDataItem & PlainObjectType));
        }
      }
      return newData;
    }
  }
  return queryData;
}

export function updateQueryData<TDataItem>(
  queryData: InfiniteData<InfiniteQueryResultType<TDataItem>> | InfiniteQueryResultType<TDataItem> | QueryResultType<TDataItem> | undefined,
  select: number | ((item: TDataItem & PlainObjectType) => boolean),
  fnUpdater: Function
) {
  if (select !== undefined) {
    const predicate = select instanceof Function ? select : (item: TDataItem & PlainObjectType) => item.id === select;

    if (queryData) {
      // True immutable copy
      queryData = JSON.parse(JSON.stringify(queryData));

      if ((queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pages) {
        const newPagesArray =
        (queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pages.map((page) => {
            // update item
            if (page.data) {
              page.data = [
                ...page.data.map((item) => {
                  if (predicate(item)) {
                    item = { ...item }; // Immutable copy
                    fnUpdater(item);
                  }
                  return item;
                }),
              ];
            }

            return page;
          }) ?? [];

        return {
          pages: newPagesArray,
          pageParams: (queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pageParams,
        };
      } else if ((queryData as QueryResultType<TDataItem>).length) {
        return [
          ...(queryData as QueryResultType<TDataItem>).map((item) => {
            if (predicate(item)) {
              item = { ...item }; // Immutable copy
              fnUpdater(item);
            }
            return item;
          }),
        ];
      } else if ((queryData as InfiniteQueryResultType<TDataItem>).data) {
        const newData = [
          ...(queryData as InfiniteQueryResultType<TDataItem> & { data: [] }).data.map((item) => {
            if (predicate(item)) {
              item = { ...item }; // Immutable copy
              fnUpdater(item);
            }
            return item;
          }),
        ];

        return {
          data: newData,
          count: (queryData as InfiniteQueryResultType<TDataItem>).count,
        };
      } else {
        fnUpdater(queryData);

        return queryData;
      }
    }
  }
  return queryData;
}

export function removeQueryData<TDataItem>(
  queryData: InfiniteData<InfiniteQueryResultType<TDataItem>> | QueryResultType<TDataItem> | undefined, 
  select: number | ((item: TDataItem & PlainObjectType) => boolean)) {
  if (select !== undefined) {
    const predicate = select instanceof Function ? select : (item: TDataItem & PlainObjectType) => item.id === select;

    if (queryData) {
      // True immutable copy
      queryData = JSON.parse(JSON.stringify(queryData));

      if ((queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pages) {
        const newPagesArray =
        (queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pages.map((page) => {
            // update item
            if (page.data) {
              page.data = [...page.data.filter((item) => !predicate(item))];
            }
            return page;
          }) ?? [];

        return {
          pages: newPagesArray,
          pageParams: (queryData as InfiniteData<InfiniteQueryResultType<TDataItem>>).pageParams,
        };
      } else if ((queryData as QueryResultType<TDataItem>).length) {
        return [...(queryData as QueryResultType<TDataItem>).filter((item) => !predicate(item))];
      }
    }
  }
  return queryData;
}

export const addCacheItem = <T>(
  queryClient: QueryClient,
  key: QueryKey,
  item: T,
  tempId?: number,
  sorting?: { by?: string; descending?: boolean }
): T | void => {
  return queryClient.setQueryData(key, (data: unknown) => {
    return addToQueryData(data as InfiniteData<InfiniteQueryResultType<T>, unknown> | QueryResultType<T> | undefined, item, sorting, tempId) as NoInfer<void | T> | undefined
  });
};

export const addCacheItems = <T>(
  queryClient: QueryClient,
  filters: QueryFilters,
  item: T,
  tempId?: number,
  sorting?: { by?: string; descending?: boolean }
): T | void => {
  queryClient.setQueriesData<InfiniteData<InfiniteQueryResultType<T>, unknown> | QueryResultType<T>>(filters, (data) => addToQueryData<T>(data, item, sorting, tempId));
};

export const updateCacheItem = <T>(
  queryClient: QueryClient,
  key: QueryKey,
  select: number | ((item: T) => boolean),
  fnUpdater: Function
): T | void => {
  return queryClient.setQueryData(key, (data: unknown) => {
    return updateQueryData(data as InfiniteQueryResultType<T> | InfiniteData<InfiniteQueryResultType<T>, unknown> | QueryResultType<T> | undefined, select, fnUpdater) as NoInfer<void | T> | undefined
  });
};

export const updateCacheItems = <T>(
  queryClient: QueryClient,
  filters: QueryFilters,
  select: number | ((item: T) => boolean),
  fnUpdater: Function
): T | void => {
  queryClient.setQueriesData(filters, (data: unknown) => { 
    return updateQueryData(data as InfiniteData<InfiniteQueryResultType<T>, unknown> | QueryResultType<T>, select, fnUpdater) as NoInfer<void | T> | undefined 
  });
};

export const removeCacheItem = <T>(
  queryClient: QueryClient,
  key: QueryKey,
  select: number | ((item: T) => boolean)
): T | void => {
  return queryClient.setQueryData(key, (data: unknown) => {
    return removeQueryData(data as InfiniteData<InfiniteQueryResultType<T>, unknown> | QueryResultType<T>, select) as NoInfer<void | T> | undefined 
  });
};

export const removeCacheItems = <T>(
  queryClient: QueryClient,
  filters: QueryFilters,
  select: number | ((item: T) => boolean)
): T | void => {
  queryClient.setQueriesData(filters, (data: unknown) => {
    return removeQueryData(data as InfiniteData<InfiniteQueryResultType<T>, unknown> | QueryResultType<T>, select)
  });
};

// export const setCacheItem = (queryClient: QueryClient, key: QueryKey, id: number, updated: any) => {
//     const data = queryClient.getQueryData<any>(key);
//     if (data) {
//         if (data.pages) {
//             const newPagesArray = data.pages.map((page: any, i: number) => {
//                 // update entity
//                 page.data = [...page.data.map((item: any) => item.id === id ? updated : item)]
//                 return page;
//             }) ?? [];

//             queryClient.setQueryData(key, (data: any) => ({
//                 pages: newPagesArray,
//                 pageParams: data.pageParams,
//             }));
//         } else {
//             // not paged data...
//         }
//     }
// }

export function keepFirstPage(queryClient: QueryClient, queryKey: QueryKey, options?: SetDataOptions) {
  const currentData: InfiniteData<unknown> | undefined = queryClient.getQueryData(queryKey);

  if (currentData?.pages?.length && currentData.pages.length > 1) {
    queryClient.setQueryData(
      queryKey,
      (data: InfiniteData<unknown>) => {
        return {
          pages: data.pages.slice(0, 1),
          pageParams: data.pageParams.slice(0, 1),
        };
      },
      options
    );
  }
}
