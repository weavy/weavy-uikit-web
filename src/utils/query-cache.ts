import { InfiniteData, QueryClient, QueryFilters, QueryKey, SetDataOptions } from "@tanstack/query-core";

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
  queryData: InfiniteData<any> | undefined,
  propertyName: string,
  value: string,
  copy = false
) {
  let existingItem: TDataItem | undefined;
  // Find any existing item with same property value
  if (queryData && queryData.pages) {
    queryData.pages.some((page: any) => {
      return page.data?.some((item: any) => {
        if (item[propertyName] === value) {
          existingItem = item;
          return true;
        }
        return false;
      });
    });
  }

  return existingItem && copy ? <TDataItem>{ ...existingItem } : existingItem;
}

export function addToQueryData(
  queryData: any,
  item: any,
  sorting: { by?: string; descending?: boolean } = {},
  tempId?: number
) {
  if (queryData) {
    // True immutable copy
    queryData = JSON.parse(JSON.stringify(queryData));

    if (queryData.pages) {
      let foundIndex = -1;

      const newPagesArray =
        queryData.pages.map((page: any, i: number) => {
          if (foundIndex >= 0) {
            return page;
          }

          const pageData = (page.data as any[]) || [];

          // remove any previous item or tempId
          const newData = pageData.filter(
            (pageItem: any) => pageItem.id !== item.id && (!tempId || pageItem.id !== tempId)
          );

          if (sorting && sorting.by) {
            // Use sorting
            foundIndex = newData.findIndex((pageItem: any) => {
              let pageItemValue = pageItem[sorting.by!];
              let itemValue = item[sorting.by!];

              // modified_at should fallback to created_at
              if (sorting.by === "modified_at") {
                pageItemValue ??= pageItem["created_at"];
                itemValue ??= item["created_at"];
              }

              if (typeof pageItemValue === "string" && typeof itemValue === "string") {
                const sortCompare = pageItemValue.localeCompare(itemValue, undefined, {
                  sensitivity: "base",
                  numeric: true,
                });
                return sorting.descending ? sortCompare < 0 : sortCompare > 0;
              }

              return sorting.descending ? pageItemValue < itemValue : pageItemValue > itemValue;
            });

            if (foundIndex >= 0) {
              newData.splice(foundIndex, 0, item);
              page.data = [...newData];
              if (page.end) {
                page.end += 1 + newData.length - pageData.length;
              }
            } else if (i == queryData.pages.length - 1 && page.end === page.count) {
              // end of the list
              page.data = [...newData, item];

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
                page.data = [item, ...newData];
              } else {
                page.data = [...newData, item];
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
        pageParams: [...queryData.pageParams],
      };
    } else if (queryData.length) {
      // not paged data...
      let foundIndex = -1;
      // remove any previous item or tempId
      const newData = [
        ...queryData.filter((dataItem: any) => dataItem.id !== item.id && (!tempId || dataItem.id !== tempId)),
      ];

      if (sorting && sorting.by) {
        // Use sorting
        foundIndex = newData.findIndex((dataItem: any) => {
          let dataItemValue = dataItem[sorting.by!];
          let itemValue = item[sorting.by!];

          // modified_at should fallback to created_at
          if (sorting.by === "modified_at") {
            dataItemValue ??= dataItem["created_at"];
            itemValue ??= item["created_at"];
          }

          if (typeof dataItemValue === "string" && typeof itemValue === "string") {
            const sortCompare = dataItemValue.localeCompare(itemValue, undefined, {
              sensitivity: "base",
              numeric: true,
            });
            return sorting.descending ? sortCompare < 0 : sortCompare > 0;
          }

          return sorting.descending ? dataItemValue < itemValue : dataItemValue > itemValue;
        });

        if (foundIndex >= 0) {
          newData.splice(foundIndex, 0, item);
        } else {
          // end of the list
          newData.push(item);
        }
      } else {
        // no specific sorting
        if (sorting.descending) {
          newData.unshift(item);
        } else {
          newData.push(item);
        }
      }
      return newData;
    }
  }
  return queryData;
}

export function updateQueryData(queryData: any, select: number | ((item: any) => boolean), fnUpdater: Function) {
  if (select !== undefined) {
    const predicate = select instanceof Function ? select : (item: any) => item.id === select;
    
    if (queryData) {
      // True immutable copy
      queryData = JSON.parse(JSON.stringify(queryData));

      if (queryData.pages) {
        const newPagesArray =
          queryData.pages.map((page: any) => {
            // update item
            if (page.data) {
              page.data = [
                ...page.data.map((item: any) => {
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
          pageParams: queryData.pageParams,
        };
      } else if (queryData.length) {
        return [
          ...queryData.map((item: any) => {
            if (predicate(item)) {
              item = { ...item }; // Immutable copy
              fnUpdater(item);
            }
            return item;
          }),
        ];
      } else if (queryData.data) {
        const newData = [
          ...queryData.data.map((item: any) => {
            if (predicate(item)) {
              item = { ...item }; // Immutable copy
              fnUpdater(item);
            }
            return item;
          }),
        ];

        return {
          data: newData,
          count: queryData.count,
        };
      } else {
        fnUpdater(queryData);

        return queryData;
      }
    }
  }
  return queryData;
}

export function removeQueryData(queryData: any, select: number | ((item: any) => boolean)) {
  if (select !== undefined) {
    const predicate = select instanceof Function ? select : (item: any) => item.id === select;

    if (queryData) {
      // True immutable copy
      queryData = JSON.parse(JSON.stringify(queryData));

      if (queryData.pages) {
        const newPagesArray =
          queryData.pages.map((page: any) => {
            // update item
            page.data = [...page.data.filter((item: any) => !predicate(item))];
            return page;
          }) ?? [];

        return {
          pages: newPagesArray,
          pageParams: queryData.pageParams,
        };
      } else if (queryData.length) {
        return [...queryData.filter((item: any) => !predicate(item))];
      }
    }
  }
  return queryData;
}

export const addCacheItem = <T>(
  queryClient: QueryClient,
  key: QueryKey,
  item: any,
  tempId?: number,
  sorting?: { by?: string; descending?: boolean }
): T | void => {
  return queryClient.setQueryData(key, (data: any) => addToQueryData(data, item, sorting, tempId));
};

export const addCacheItems = <T>(
  queryClient: QueryClient,
  filters: QueryFilters,
  item: any,
  tempId?: number,
  sorting?: { by?: string; descending?: boolean }
): T | void => {
  queryClient.setQueriesData(filters, (data: any) => addToQueryData(data, item, sorting, tempId));
};

export const updateCacheItem = <T>(
  queryClient: QueryClient,
  key: QueryKey,
  select: number | ((item: any) => boolean),
  fnUpdater: Function
): T | void => {
  return queryClient.setQueryData(key, (data: any) => updateQueryData(data, select, fnUpdater));
};

export const updateCacheItems = <T>(
  queryClient: QueryClient,
  filters: QueryFilters,
  select: number | ((item: any) => boolean),
  fnUpdater: Function
): T | void => {
  queryClient.setQueriesData(filters, (data: any) => updateQueryData(data, select, fnUpdater));
};

export const removeCacheItem = <T>(
  queryClient: QueryClient,
  key: QueryKey,
  select: number | ((item: any) => boolean)
): T | void => {
  return queryClient.setQueryData(key, (data: any) => removeQueryData(data, select));
};

export const removeCacheItems = <T>(
  queryClient: QueryClient,
  filters: QueryFilters,
  select: number | ((item: any) => boolean)
): T | void => {
  queryClient.setQueriesData(filters, (data: any) => removeQueryData(data, select));
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
