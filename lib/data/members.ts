import { MembersResultType } from "../types/members.types";
import { type WeavyType } from "../client/weavy";
import type {
  InfiniteData,
  InfiniteQueryObserverOptions,
  //QueryClient,
  QueryObserverOptions,
  QueryOptions,
} from "@tanstack/query-core";
//import { updateCacheItems } from "../utils/query-cache";
//import { AppType } from "../types/app.types";

export function getMemberOptions(weavy: WeavyType, appId: number, options: QueryOptions<MembersResultType>) {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return <QueryObserverOptions<MembersResultType>>{
    queryKey: ["members", appId],
    queryFn: async () => {
      const response = await weavy.fetch(`/api/apps/${appId}/members`);
      const result = (await response.json()) as MembersResultType;
      return result;
    },
    ...options,
  };
}

export function getInfiniteSearchMemberOptions(
  weavy: WeavyType,
  text: () => string,
  appId: number | undefined,
  getAgent: () => boolean | undefined,
): InfiniteQueryObserverOptions<MembersResultType, Error, InfiniteData<MembersResultType>> {
  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  return {
    queryKey: ["search__members", appId],
    initialPageParam: 0,
    enabled: true,
    queryFn: async (opt) => {
      const query = text();
      const skip = opt.pageParam as number;
      let response;

      if (appId) {
        response = await weavy.fetch(
          `/api/apps/${appId}/members?q=${query}${getAgent() !== undefined ? `&agent=${Boolean(getAgent())}` : ""}&member=false&system=false&skip=${skip}`,
        );
      } else {
        response = await weavy.fetch(
          `/api/users?q=${query}${getAgent() !== undefined ? `&agent=${Boolean(getAgent())}` : ""}&system=false&skip=${skip}`,
        );
      }

      const result = (await response.json()) as MembersResultType;
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


/*export function updateMembers(queryClient: QueryClient, appId: number | "feed" | null,  filter, updater) {
      const updateMembersInApps = (members: MemberType[] = []) => {
        members.forEach((m) => {
          m.presence = data.indexOf(m.id) != -1 ? "active" : "away";
        });
        return members;
      };
  
      queryClient.setQueryData(["apps", appId], (app: AppType) => {
        app.members.data = updateMembersInApps(app.members.data);
        return app;
      });
      queryClient.setQueryData(["members", appId], (members: MemberDetailType[]) => updateMembersInApps(members));



      updateCacheItems(queryClient, { queryKey: ["apps", "list"], exact: false }, undefined, updateMembersInApps);

      updateCacheItems(queryClient, { queryKey: ["members"], exact: false }, user.id, (m: MemberType) => {
        m.is_followed = follow;
      });

      updateCacheItems<PostType>(queryClient, { queryKey: ["posts"], exact: false }, (post: PostType) => post.created_by.id === user.id, (post: PostType) => {
        post.created_by.is_followed = follow;
      });
}*/