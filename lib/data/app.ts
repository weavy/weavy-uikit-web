import {
  FetchQueryOptions,
  InfiniteData,
  InfiniteQueryObserverOptions,
  MutationKey,
  MutationObserver,
  QueryObserverOptions,
} from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import {
  AppUpProperties,
  AppsResultType,
  AppTypeGuid,
  AppTypeString,
  type AppType,
  UnknownAppType,
} from "../types/app.types";
import { getApi, getApiMutation, getApiOptions } from "./api";
import { UnknownApp } from "../classes/weavy-app-component";

export function getAppOptions<T extends AppType = AppType>(
  weavy: WeavyType,
  uid: string | number,
  type: AppTypeString | UnknownAppType = UnknownApp,
  appData?: AppUpProperties
) {
  return type === UnknownApp || typeof uid === "number"
    ? getApiOptions<T>(weavy, ["apps", uid])
    : getApiOptions<T>(weavy, ["apps", uid], undefined, undefined, JSON.stringify({ type, ...appData }), "PUT");
}

export function getApp<T extends AppType = AppType>(
  weavy: WeavyType,
  uid: string | number,
  type: AppTypeString | UnknownAppType = UnknownApp,
  appData?: AppUpProperties
) {
  return type === UnknownApp || typeof uid === "number"
    ? getApi<T>(weavy, ["apps", uid])
    : getApi<T>(weavy, ["apps", uid], undefined, undefined, JSON.stringify({ type, ...appData }), "PUT");
}

export function getOrCreateAppOptions<T extends AppType = AppType>(
  weavy: WeavyType,
  uid: string | number,
  type: AppTypeGuid | UnknownAppType = UnknownApp,
  members?: (number | string)[],
  appData?: AppUpProperties
) {
  return <QueryObserverOptions<T>>{
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["apps", uid],
    queryFn: async () => {
      //console.log("API", method, apiPath ? apiPath : "/api/" + apiKey.join("/"));

      const appsRequests = [];

      if (type === UnknownApp || typeof uid === "number") {
        appsRequests.push(
          // Get existing app
          weavy.fetch(`/api/apps/${uid}`)
        );
      } else if (members?.length) {
        // Get the succeeding one of GET and POST
        appsRequests.push(
          // Get existing app
          weavy.fetch(`/api/apps/${uid}`)
        );
        appsRequests.push(
          // Create app with members
          weavy.fetch(`/api/apps`, { method: "POST", body: JSON.stringify({ type, members, uid, ...appData }) })
        );
      } else {
        appsRequests.push(
          // Get, update or create app (upsert) using app uid
          weavy.fetch(`/api/apps/${uid}`, { method: "PUT", body: JSON.stringify({ type, ...appData }) })
        );
      }

      const result = (await Promise.allSettled(appsRequests)).findLast(
        (result) => result.status === "fulfilled" && result.value?.ok
      );

      const response = result?.status === "fulfilled" && result.value;

      if (response) {
        return (await response.json()) as T;
      } else {
        throw new Error(`Error getting or creating app ${uid}`);
      }
    },
  };
}

export async function getOrCreateApp<T extends AppType = AppType>(
  weavy: WeavyType,
  uid: string | number,
  type: AppTypeGuid | UnknownAppType = UnknownApp,
  members?: (number | string)[],
  appData?: AppUpProperties
) {
  const queryClient = weavy.queryClient;
  const appOptions = getOrCreateAppOptions(weavy, uid, type, members, appData);

  return await queryClient.fetchQuery<T>(appOptions as FetchQueryOptions<T>);
}

export type MutateAddAppVariables = {
  name?: string;
  members: (number | string)[];
  type: AppTypeString;
  uid?: string;
};

export type CreateAppMutationType = MutationObserver<AppType, Error, MutateAddAppVariables, void>;

export function getCreateAppMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ name, members, type, uid }: MutateAddAppVariables) => {
      const response = await weavy.fetch(`/api/apps`, {
        method: "POST",
        body: JSON.stringify({
          name,
          members,
          type,
          uid,
        }),
      });
      return (await response.json()) as AppType;
    },
    onSettled: async () => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  };

  return options;
}

export function getCreateAppMutation(weavy: WeavyType): CreateAppMutationType {
  return new MutationObserver(weavy.queryClient, getCreateAppMutationOptions(weavy));
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

  const mutationKey: MutationKey = ["apps", app.uid || app.id];

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
        throw new Error(`Could not subscribe to app ${app.uid || app.id}.`);
      }
    },
    onMutate: (variables: MutateAppSubscribeProps) => {
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

/**
 * Gets number of unread conversations/apps.
 */
export function getAppsUnreadOptions(
  weavy: WeavyType,
  types: AppTypeGuid[] | null = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat],
  member?: string
) {
  const queryParams = new URLSearchParams({
    count_only: "true",
    unread: "true",
    uid: "false",
  });

  if (member) {
    queryParams.append("member", member);
  }

  types?.forEach((type) => queryParams.append("type", type));
  const url = `/api/apps?${queryParams.toString()}`;
  const queryKey = ["apps", "unread", types, member];
  return getApiOptions<AppsResultType>(weavy, queryKey, url);
}

export function getAppListOptions(
  weavy: WeavyType,
  options: object = {},
  types?: AppTypeGuid[] | null,
  member?: string,
  searchText?: () => string | undefined,
  orderBy?: string | null,
  includeUid?: boolean | null
): InfiniteQueryObserverOptions<AppsResultType, Error, InfiniteData<AppsResultType>> {
  return {
    ...options,
    initialPageParam: 0,
    queryKey: ["apps", "list", types, member, orderBy, includeUid],
    queryFn: async (opt) => {
      const queryParams = new URLSearchParams();

      if (member) {
        queryParams.append("member", member);
      }

      if (opt.pageParam && typeof opt.pageParam === "number") {
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

      if (includeUid === false) {
        queryParams.append("uid", "false");
      }

      const url = `/api/apps?${queryParams.toString()}`;

      const response = await weavy.fetch(url);
      const result = (await response.json()) as AppsResultType;
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
