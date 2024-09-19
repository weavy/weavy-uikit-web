import { MembersResultType } from "../types/members.types";
import { type WeavyType } from "../client/weavy";
import type {
  InfiniteData,
  InfiniteQueryObserverOptions,
  QueryFunction,
  QueryFunctionContext,
  QueryKey,
  QueryObserverOptions,
  QueryOptions,
} from "@tanstack/query-core";

export function getMemberOptions(weavy: WeavyType, appId: number, options: QueryOptions<MembersResultType>) {
  return <QueryObserverOptions<MembersResultType>> {
    queryKey: ["members", appId],
    queryFn: async () => {
      const response = await weavy.fetch("/api/apps/" + appId + "/members");
      const result: MembersResultType = await response.json();
      return result;
    },
    ...options
  };
}

export function getInfiniteSearchMemberOptions(
  weavy: WeavyType,
  text: () => string,
  appId: number | undefined,
  bot: () => boolean | undefined  
): InfiniteQueryObserverOptions<MembersResultType, Error, InfiniteData<MembersResultType>> {
  const PAGE_SIZE = 25;

  return {
    queryKey: ["searchmembers"],
    initialPageParam: 0,
    enabled: true,
    queryFn: <QueryFunction<MembersResultType, QueryKey, number | unknown>>(async (
      opt: QueryFunctionContext<QueryKey, number>
    ) => {
      const query = text();
      const skip = opt.pageParam;
      let response;
      
      if (appId) {
        response = await weavy.fetch(`/api/apps/${appId}/members?member=false&q=${query}&skip=${skip}&take=${PAGE_SIZE}&count=true${bot() !== undefined ? `&bot=${Boolean(bot())}` : ""}`);
      } else {
        response = await weavy.fetch(`/api/users?q=${query}&skip=${skip}&take=${PAGE_SIZE}&count=true${bot() !== undefined ? `&bot=${Boolean(bot())}` : ""}`);
      }          

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
