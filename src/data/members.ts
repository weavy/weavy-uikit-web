import { MembersResultType } from "src/types/members.types";
import { type WeavyContext } from "../client/weavy-context";
import {
  InfiniteData,
  InfiniteQueryObserverOptions,
  QueryFunction,
  QueryFunctionContext,
  QueryKey,
} from "@tanstack/query-core";

export function getMemberOptions(weavyContext: WeavyContext, appId: number) {
  return {
    queryKey: ["members", appId],
    queryFn: async () => {
      const response = await weavyContext.get("/api/apps/" + appId + "/members");
      const result: MembersResultType = await response.json();
      return result;
    },
  };
}

export function getSearchMemberOptions(weavyContext: WeavyContext, text: () => string) {
  const PAGE_SIZE = 25;

  return {
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
  weavyContext: WeavyContext,
  text: () => string
): InfiniteQueryObserverOptions<MembersResultType, Error, InfiniteData<MembersResultType>> {
  const PAGE_SIZE = 25;

  return {
    queryKey: ["searchmembers"],
    initialPageParam: 0,
    enabled: true,
    queryFn: <QueryFunction<MembersResultType, QueryKey, unknown>>(async (
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
    getNextPageParam: (lastPage: any, pages: any) => {
      if (lastPage?.end < lastPage?.count) {
        return pages.length * PAGE_SIZE;
      }
      return undefined;
    },
  };
}
