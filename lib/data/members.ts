import { MembersResultType } from "../types/members.types";
import { type WeavyContextType } from "../client/weavy-context";
import type {
  InfiniteData,
  InfiniteQueryObserverOptions,
  QueryFunction,
  QueryFunctionContext,
  QueryKey,
  QueryObserverOptions,
  QueryOptions,
} from "@tanstack/query-core";

export function getMemberOptions(weavyContext: WeavyContextType, appId: number, options: QueryOptions<MembersResultType>) {
  return <QueryObserverOptions<MembersResultType>> {
    queryKey: ["members", appId],
    queryFn: async () => {
      const response = await weavyContext.get("/api/apps/" + appId + "/members");
      const result: MembersResultType = await response.json();
      return result;
    },
    ...options
  };
}

export function getSearchMemberOptions(weavyContext: WeavyContextType, text: () => string) {
  const PAGE_SIZE = 25;

  return {
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["searchmembers"],
    enabled: false,
    queryFn: async () => {
      const query = text() || "*";
      const response = await weavyContext.get(`/api/users/autocomplete?q=${query}&skip=0&top=${PAGE_SIZE}`);
      const result: MembersResultType = await response.json();
      return result;
    },
  };
}

export function getInfiniteSearchMemberOptions(
  weavyContext: WeavyContextType,
  text: () => string
): InfiniteQueryObserverOptions<MembersResultType, Error, InfiniteData<MembersResultType>> {
  const PAGE_SIZE = 25;

  return {
    queryKey: ["searchmembers"],
    initialPageParam: 0,
    enabled: true,
    queryFn: <QueryFunction<MembersResultType, QueryKey, number | unknown>>(async (
      opt: QueryFunctionContext<QueryKey, number>
    ) => {
      const inputText = text();
      const query = inputText || "*";
      const skip = opt.pageParam;
      const response = await weavyContext.get(
        `/api/users/autocomplete?q=${query}&skip=${skip}&top=${PAGE_SIZE}&count=${Boolean(!inputText)}`
      );
      const result = await response.json();
      result.data = result.data || [];
      return result;
    }),
    getNextPageParam: (lastPage, pages) => {
      if (lastPage?.end && lastPage?.end < lastPage?.count) {
        return pages.length * PAGE_SIZE;
      }
      return undefined;
    },
  };
}
