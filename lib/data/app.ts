import {
  InfiniteData,
  InfiniteQueryObserverOptions,
  MutationKey,
  MutationObserver,
  MutationObserverOptions,
} from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import {
  AppUpProperties,
  AppsResultType,
  AppTypeGuid,
  AppTypeString,
  type AppType,
  AppUidType,
} from "../types/app.types";
import { firstPageParam, getApiMutation, getApiOptions, initialPageParam, lastPageParam, queryPageParams } from "./api";
import { QueryController } from "../controllers/query-controller";
import { onlyValues } from "../utils/data";
import { QueryPagingAroundType } from "../types/query.types";
import { HttpError } from "../utils/errors";
import type { MutationAbortProps } from "../types/query.types";

/**
 * Options for reading a single app.
 *
 * This is the one and only query for app data: every component observes it, whether or not the component is allowed to
 * create the app. Creating is done separately by {@link ensureApp}, which seeds this query with the result.
 *
 * The split matters because a TanStack query has a single `queryFn` shared by every observer of its key, and an
 * observer that joins a fetch already in flight never gets to apply its own options
 * (see https://github.com/TanStack/query/blob/main/packages/query-core/src/query.ts, `Query.fetch`). Letting creating
 * and lookup-only components supply different `queryFn`s for `["apps", uid]` therefore made the effective request
 * depend on which component happened to fetch first.
 *
 * @param weavy - The weavy client.
 * @param uid - Unique app identifier or app id.
 * @returns Query options for the app.
 */
export function getAppOptions<T extends AppType = AppType>(weavy: WeavyType, uid: string | number) {
  return getApiOptions<T>(weavy, ["apps", uid], undefined, {
    // An app that does not exist yet is an answer, not a failure, so a 404 must not sit in retry backoff while the
    // upsert is already creating it. Timeouts and rate limits are transient though, so they keep the default retry
    // count along with server and transport failures.
    retry: (failureCount, error) =>
      !(error instanceof HttpError && error.status < 500 && error.status !== 408 && error.status !== 429) &&
      failureCount < 3,
  });
}

/**
 * Options for the mutation that makes sure an app exists.
 *
 * Creating an app is a write, so it runs as a mutation rather than as the `queryFn` of `["apps", uid]`. A TanStack
 * query pairs exactly one `queryFn` with a key (https://github.com/TanStack/query/discussions/4020), so letting a
 * creating component and a lookup-only component supply different ones made the effective request depend on whichever
 * happened to fetch first — and when the lookup won, the app was never created at all.
 *
 * Being a mutation also keeps the default `networkMode`, so an upsert attempted while offline is paused and retried in
 * order once the connection returns
 * (https://tanstack.com/query/latest/docs/framework/react/guides/network-mode), which a bare `weavy.fetch` would not
 * do — it would simply reject, leaving the app uncreated.
 *
 * `onSuccess` writes the app straight into the app query. That is the documented way to avoid spending a second
 * request on data the response already carries
 * (https://tanstack.com/query/latest/docs/framework/react/guides/updates-from-mutation-responses), and it reaches
 * every observer of the app, lookup-only components included.
 *
 * Concurrent upserts for the same uid are not deduplicated here. Callers are expected to upsert only when the app is
 * missing or its data has changed, and the request is an idempotent upsert, so the worst case is a duplicate write
 * rather than a wrong result.
 *
 * @param weavy - The weavy client.
 * @param uid - Unique app identifier. App ids cannot be upserted and must not be passed.
 * @param type - The type of app to create.
 * @param members - Members for the app. Creates the app with `POST /api/apps` instead of upserting it by uid.
 * @param appData - Additional app properties, such as name and directory.
 * @returns Mutation options for the upsert.
 */
export function getEnsureAppMutationOptions(
  weavy: WeavyType,
  uid: string,
  type: AppTypeGuid,
  members?: (number | string)[],
  appData?: AppUpProperties,
): MutationObserverOptions<AppType, Error, MutationAbortProps, void> {
  return {
    mutationKey: ["apps", uid, "upsert"],
    mutationFn: async () => {
      const appsRequests = [];

      if (members?.length) {
        // Creating with members uses POST, which fails when the app already exists. Ask for the app and create it at
        // the same time, then keep whichever of the two succeeded.
        appsRequests.push(
          // Get existing app
          weavy.fetch(`/api/apps/${uid}`),
        );
        appsRequests.push(
          // Create app with members
          weavy.fetch(`/api/apps`, { method: "POST", body: JSON.stringify({ type, members, uid, ...appData }) }),
        );
      } else {
        appsRequests.push(
          // Get, update or create app (upsert) using app uid
          weavy.fetch(`/api/apps/${uid}`, { method: "PUT", body: JSON.stringify({ type, ...appData }) }),
        );
      }

      const result = (await Promise.allSettled(appsRequests)).findLast(
        (result) => result.status === "fulfilled" && result.value?.ok,
      );

      const response = result?.status === "fulfilled" && result.value;

      if (!response) {
        throw new Error(`Error getting or creating app ${uid}`);
      }

      return (await response.json()) as AppType;
    },
    onSuccess: (app) => {
      // Hand the app to every observer of the app query instead of making them fetch what we already have.
      weavy.queryClient.setQueryData(["apps", uid], app);
    },
  };
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
 * Gets multiple apps at once.
 */
export function getMultipleAppsOptions(
  weavy: WeavyType,
  uids: Array<string | number>,
  types?: AppTypeGuid[],
  member?: string,
) {
  const queryParams = new URLSearchParams();

  uids.forEach((uid) => {
    queryParams.append("uid", uid.toString());
  });

  if (member) {
    queryParams.append("member", member);
  }

  types?.forEach((type) => queryParams.append("type", type));

  const url = `/api/apps?${queryParams.toString()}`;
  const queryKey = ["apps", "multiple", uids, types, member];
  return getApiOptions<AppsResultType>(weavy, queryKey, url);
}

/**
 * Gets number of unread conversations/apps.
 * Agent-chat-only queries exclude apps with a uid to keep contextual chats out of the standalone inbox.
 */
export function getAppsUnreadOptions(
  weavy: WeavyType,
  types: AppTypeGuid[] | null = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat],
  member?: string,
) {
  const queryParams = new URLSearchParams({
    count_only: "true",
    unread: "true",
  });

  if (types?.length === 1 && types.includes(AppTypeGuid.AgentChat)) {
    queryParams.append("uid", "false");
  }

  if (member) {
    queryParams.append("member", member);
  }

  types?.forEach((type) => queryParams.append("type", type));
  const url = `/api/apps?${queryParams.toString()}`;
  const queryKey = ["apps", "unread", types, member];
  return getApiOptions<AppsResultType>(weavy, queryKey, url);
}

export type AppsListFilterType = {
  around?: number,
  orderBy?: string | null,
}

/**
 * Gets a paginated app list. Agent-chat-only queries exclude apps with a uid, matching the unread query.
 */
export function getAppListOptions(
  weavy: WeavyType,
  types?: AppTypeGuid[] | null,
  member?: string,
  filters: AppsListFilterType = {},
  searchText?: () => string | undefined,
  options: object = {},
): InfiniteQueryObserverOptions<AppsResultType, Error, InfiniteData<AppsResultType>> {
  return {
    ...options,
    initialPageParam: initialPageParam(filters.around),
    queryKey: ["apps", "list", types, member, filters],
    queryFn: async (opt) => {
      const queryParams = queryPageParams(opt.pageParam as QueryPagingAroundType);

      if (member) {
        queryParams.append("member", member);
      }

      types?.forEach((type) => queryParams.append("type", type));

      if (filters.orderBy) {
        queryParams.append("order_by", filters.orderBy);
      }

      const q = searchText?.();
      if (q) {
        queryParams.append("q", q);
      }

      if (types?.length === 1 && types.includes(AppTypeGuid.AgentChat)) {
        queryParams.append("uid", "false");
      }

      const url = `/api/apps?${queryParams.toString()}`;

      const response = await weavy.fetch(url);
      return (await response.json()) as AppsResultType;
    },
    getPreviousPageParam: firstPageParam(),
    getNextPageParam: lastPageParam(),
  };
}

/**
 * Support function to use multiple controllers to get apps instead of getting a proper app list directly.
 * 
 * @param multipleAppsQueryMap - Map of AppType query controllers
 * @returns 
 */
export function mapMultipleAppsAsAppList(multipleAppsQueryMap: Map<AppUidType, QueryController<AppType>>) {
  const data = Array.from(multipleAppsQueryMap.values())
    .map((query) => query.result.data)
    .filter(onlyValues<AppType>);

  const isPending = multipleAppsQueryMap.size
    ? Array.from(multipleAppsQueryMap.values()).reduce((prevValue, query) => {
        return prevValue || query.result.isPending;
      }, false)
    : false;

  const resultData: AppsResultType | undefined = multipleAppsQueryMap.size
    ? {
        data,
        count: data.length,
      }
    : undefined;

  return {
    result: {
      data: resultData,
      isPending,
    },
  };
}
