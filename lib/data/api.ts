import type {
  QueryOptions,
  QueryKey,
  FetchQueryOptions,
  QueryObserverOptions,
  MutationOptions,
} from "@tanstack/query-core";
import { MutationObserver } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { HttpMethodType } from "../types/http.types";
import { HttpError } from "../utils/errors";
import { InfiniteQueryResultType, QueryPagingAroundType, QueryPagingType } from "../types/query.types";
import { IntRange, PlainObjectType } from "../types/generic.types";

export function getApiOptions<T>(
  weavy: WeavyType,
  apiKey: QueryKey,
  apiPath?: string,
  options?: Partial<QueryObserverOptions<T>>,
  body?: BodyInit,
  method: HttpMethodType = "GET",
) {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return <QueryObserverOptions<T>>{
    queryKey: apiKey,
    queryFn: async () => {
      //console.log("API", method, apiPath ? apiPath : "/api/" + apiKey.join("/"));
      const response = await weavy.fetch(apiPath ? apiPath : "/api/" + apiKey.join("/"), { method, body });

      if (response.ok) {
        return (await response.json()) as T;
      } else {
        throw new HttpError(response.status, `Error calling ${apiPath ? apiPath : "/api/" + apiKey.join("/")}`);
      }
    },
    ...options,
  };
}

// GET app
export async function getApi<T>(
  weavy: WeavyType,
  apiKey: QueryKey,
  apiPath?: string,
  options?: QueryOptions<T>,
  body?: BodyInit,
  method: HttpMethodType = "GET",
  noCache: boolean = false,
) {
  const queryClient = weavy.queryClient;
  const apiOptions = getApiOptions(weavy, apiKey, apiPath, options, body, method) as FetchQueryOptions<T>;

  if (noCache) {
    apiOptions.staleTime = 1;
    return await queryClient.fetchQuery<T>(apiOptions);
  } else {
    return await queryClient.ensureQueryData<T>(apiOptions);
  }
}

export function getApiMutationOptions<T>(
  weavy: WeavyType,
  apiKey: QueryKey,
  apiPath?: string,
  options?: MutationOptions<T>,
  method: HttpMethodType = "POST",
) {
  const queryClient = weavy.queryClient;

  return <MutationOptions<T, Error, BodyInit>>{
    mutationKey: apiKey,
    mutationFn: async (body: BodyInit) => {
      const response = await weavy.fetch(apiPath ? apiPath : "/api/" + apiKey.join("/"), { method, body });
      if (response.ok) {
        return (await response.json()) as T;
      } else {
        throw new HttpError(response.status, `Error calling ${apiPath ? apiPath : "/api/" + apiKey.join("/")}`);
      }
    },
    onSuccess: (result, _variables) => {
      queryClient.setQueryData(apiKey, () => result);
    },
    ...options,
  };
}

export function getApiMutation<T>(
  weavy: WeavyType,
  apiKey: QueryKey,
  apiPath?: string,
  options?: MutationOptions<T>,
  method: HttpMethodType = "POST",
) {
  const apiMutationOptions = getApiMutationOptions(weavy, apiKey, apiPath, options, method);
  return new MutationObserver(weavy.queryClient, apiMutationOptions);
}

// INFINITE PAGING

export const DEFAULT_PAGE_SIZE = 25;

export function initialPageParam(around?: number, pageSize: IntRange<1, 100> = DEFAULT_PAGE_SIZE): QueryPagingAroundType {
  return (!Number.isNaN(around) ? { around: around, take: pageSize } : { skip: 0, take: pageSize })
}

export function firstPageParam<TDataItem extends PlainObjectType>(pageSize: IntRange<1, 100> = DEFAULT_PAGE_SIZE) {
  return (firstPage: InfiniteQueryResultType<TDataItem>): QueryPagingType | null => {
    if (firstPage.start && firstPage.start > 1) {
      const skip = Math.max(firstPage.start - pageSize - 1, 0);
      const take = Math.min(Math.max(firstPage.start - skip - 1, 1), 100) as IntRange<1, 100>;
      return { skip, take };
    }
    return null;
  };
}

export function lastPageParam<TDataItem extends PlainObjectType>(pageSize: IntRange<1, 100> = DEFAULT_PAGE_SIZE) {
  return (lastPage: InfiniteQueryResultType<TDataItem>): QueryPagingType | null => {
    if (lastPage?.end && lastPage?.end < lastPage?.count) {
      return { skip: lastPage.end, take: pageSize };
    }
    return null;
  };
}

export function queryPageParams(
  pageParam: QueryPagingAroundType,
  initialQueryParams?: ConstructorParameters<typeof URLSearchParams>[0],
) {
  const queryParams = new URLSearchParams(initialQueryParams);

  if (pageParam.take) {
    queryParams.set("take", pageParam.take.toString(10));
  }

  if (pageParam.around) {
    queryParams.set("around", pageParam.around.toString(10));
  } else if (pageParam.skip) {
    queryParams.set("skip", pageParam.skip.toString(10));
  }

  return queryParams;
}
