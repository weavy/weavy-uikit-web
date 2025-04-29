import { MembersResultType } from "../types/members.types";
import { type WeavyType } from "../client/weavy";
import type {
  InfiniteData,
  InfiniteQueryObserverOptions,
  QueryObserverOptions,
  QueryOptions,
} from "@tanstack/query-core";

export function getMemberOptions(weavy: WeavyType, appId: number, options: QueryOptions<MembersResultType>, bots?: boolean) {
  return <QueryObserverOptions<MembersResultType>> {
    queryKey: ["members", appId, bots],
    queryFn: async () => {
      const response = await weavy.fetch(`/api/apps/${appId}/members${bots !== undefined ? `?member=false&bot=${Boolean(bots)}` : ""}`);
      const result = await response.json() as MembersResultType;
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
  return {
    queryKey: ["search_members", appId],
    initialPageParam: 0,
    enabled: true,
    queryFn: async (
      opt
    ) => {
      const query = text();
      const skip = opt.pageParam as number;
      let response;
      
      if (appId) {
        response = await weavy.fetch(`/api/apps/${appId}/members?member=false&q=${query}&skip=${skip}${bot() !== undefined ? `&bot=${Boolean(bot())}` : ""}`);
      } else {
        response = await weavy.fetch(`/api/users?q=${query}&skip=${skip}${bot() !== undefined ? `&bot=${Boolean(bot())}` : ""}`);
      }          

      const result = await response.json() as MembersResultType;
      result.data = result.data || [];
      return result;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.end && lastPage.end < lastPage.count) {
        return lastPage.end;
      }
      return undefined;
    },
  };
}
