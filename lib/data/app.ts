import {
  InfiniteData,
  InfiniteQueryObserverOptions,
  MutationKey,
  MutationObserver,
  QueryFunctionContext,
  QueryKey,
} from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import {
  AppUpProperties,
  AppsResultType,
  AppTypeGuid,
  AppTypeString,
  ComponentType,
  type AppType,
} from "../types/app.types";
import { getApi, getApiMutation, getApiOptions } from "./api";

export type MutateAddAppVariables = {
  members: (number | string)[];
  type: AppTypeString;
};

export type AddAppMutationType = MutationObserver<AppType, Error, MutateAddAppVariables, void>;

export function getAppOptions<T extends AppType = AppType>(
  weavy: WeavyType,
  uid: string,
  type: AppTypeString | ComponentType = ComponentType.Unknown,
  appData?: AppUpProperties
) {
  return type === ComponentType.Unknown
    ? getApiOptions<T>(weavy, ["apps", uid])
    : getApiOptions<T>(weavy, ["apps", uid], undefined, undefined, JSON.stringify({ type, ...appData }), "PUT");
}

export function getApp<T extends AppType = AppType>(
  weavy: WeavyType,
  uid: string,
  type: AppTypeString | ComponentType = ComponentType.Unknown,
  appData?: AppUpProperties
) {
  return type === ComponentType.Unknown
    ? getApi<T>(weavy, ["apps", uid])
    : getApi<T>(weavy, ["apps", uid], undefined, undefined, JSON.stringify({ type, ...appData }), "PUT");
}

export async function mutateApp<T extends AppType = AppType>(weavy: WeavyType, app: T, appData?: AppUpProperties) {
  const appMutation = getApiMutation<T>(weavy, ["apps", app.uid || app.id], undefined, undefined, "PATCH");
  const appResult = appMutation.mutate(JSON.stringify({ ...appData }));

  return appResult;
}

export type MutateAppSubscribeProps = {
  subscribe: boolean;
};

export type MutateAppSubscribeContextType = { previousSubscribe: boolean | undefined; subscribe: boolean } | undefined;

export function getAppSubscribeMutationOptions(weavy: WeavyType, app: AppType) {
  const queryClient = weavy.queryClient;

  const mutationKey: MutationKey = ["apps", app.uid];

  const options = {
    mutationFn: async ({ subscribe }: MutateAppSubscribeProps) => {
      if (app.id >= 1) {
        const response = await weavy.fetch(`/api/apps/${app.id}/${subscribe ? "subscribe" : "unsubscribe"}`, {
          method: "POST",
        });
        if (!response.ok) {
          throw await response.json();
        }
      } else {
        throw new Error(`Could not subscribe to app ${app.uid}.`);
      }
    },
    onMutate: async (variables: MutateAppSubscribeProps) => {
      let previousSubscribe: boolean | undefined;
      queryClient.setQueryData(mutationKey, (mApp: AppType) => {
        //console.log("mutate subscribe", mApp);
        previousSubscribe = mApp.is_subscribed;
        return { ...mApp, is_subscribed: variables.subscribe };
      });

      const mutationContext: MutateAppSubscribeContextType = {
        previousSubscribe: previousSubscribe,
        subscribe: variables.subscribe,
      };
      return mutationContext;
    },
    onError(error: Error, variables: MutateAppSubscribeProps, context: MutateAppSubscribeContextType) {
      if (context && context.previousSubscribe !== undefined) {
        queryClient.setQueryData(mutationKey, (mApp: AppType) => {
          return { ...mApp, is_subscribed: context?.previousSubscribe };
        });
      }
    },
  };
  return options;
}

export function getBadgeOptions(
  weavy: WeavyType,
  types: AppTypeGuid[] | null = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat],
  member?: string,
  options: object = {}
) {
  const queryParams = new URLSearchParams({
    count_only: "true",
    unread: "true",
  });

  if (member) {
    queryParams.append("member", member);
  }

  types?.forEach((type) => queryParams.append("type", type));
  const url = `/api/apps?${queryParams.toString()}`;
  const queryKey = ["apps", "badge", types];
  return getApiOptions<AppsResultType>(weavy, queryKey, url, options);
}

export function getAddAppMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ members, type }: MutateAddAppVariables) => {
      const response = await weavy.fetch(`/api/apps`, {
        method: "POST",
        body: JSON.stringify({
          members,
          type,
        }),
      });
      return await response.json();
    },
    onSettled: async () => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  };

  return options;
}

export function getAddAppMutation(weavy: WeavyType): AddAppMutationType {
  return new MutationObserver(weavy.queryClient, getAddAppMutationOptions(weavy));
}

export function getAppListOptions(
  weavy: WeavyType,
  options: object = {},
  types?: AppTypeGuid[] | null,
  member?: string,
  searchText?: () => string | undefined,
  orderBy?: string | null
): InfiniteQueryObserverOptions<AppsResultType, Error, InfiniteData<AppsResultType>> {
  return {
    ...options,
    initialPageParam: 0,
    queryKey: ["apps", "list", types, member, orderBy],
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const queryParams = new URLSearchParams();

      if (member) {
        queryParams.append("member", member);
      }

      if (opt.pageParam) {
        queryParams.append("skip", opt.pageParam?.toString());
      }

      types?.forEach((type) => queryParams.append("type", type));

      if (orderBy) {
        queryParams.append("order_by", orderBy);
      }

      const q = searchText?.();
      if (q) {
        queryParams.append("q", q);
      }

      const url = `/api/apps?${queryParams.toString()}`;

      const response = await weavy.fetch(url);
      const result = await response.json();
      result.data = result.data || [];
      return result;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.end && lastPage?.end < lastPage?.count) {
        return lastPage.end;
      }
      return undefined;
    },
  };
}
