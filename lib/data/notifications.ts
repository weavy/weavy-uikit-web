import {
  InfiniteQueryObserverOptions,
  InfiniteData,
  MutationObserver,
} from "@tanstack/query-core";

import { type WeavyType } from "../client/weavy";
import { NotificationType, NotificationTypes, NotificationsResultType } from "../types/notifications.types";
import { updateCacheItems, updateCacheItemsCount } from "../utils/query-cache";
import { getApiOptions } from "./api";

export type MutateMarkNotificationVariables = {
  markAsRead: boolean;
  notificationId: number;
};
export type MutateMarkNotificationsVariables = {
  notificationId?: number;
};

export type MutateMarkNotificationContext = {
  changedNotifications: Partial<NotificationType>[];
};

export function getNotificationsOptions(
  weavy: WeavyType,
  type: NotificationTypes = NotificationTypes.All,
  appIdOrUid?: string | number,
  options: object = {}
): InfiniteQueryObserverOptions<NotificationsResultType, Error, InfiniteData<NotificationsResultType>> {
  return {
    ...options,
    initialPageParam: 0,
    queryKey: ["notifications", "list", appIdOrUid, type],
    queryFn: async (opt) => {
      const queryParams = new URLSearchParams({
        skip: opt.pageParam?.toString() || "0",
        type: type,
      });

      const url = `/api/${appIdOrUid ? `apps/${appIdOrUid.toString()}/` : ""}notifications?${queryParams.toString()}`;

      const response = await weavy.fetch(url);
      const result = await response.json() as NotificationsResultType;
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

export function getLastNotification(
  weavy: WeavyType,
  type: NotificationTypes = NotificationTypes.All,
  appIdOrUid?: string | number
) {
  const notificationsData = weavy.queryClient
    .getQueryData<InfiniteData<NotificationsResultType>>(["notifications", "list", appIdOrUid, type])
    ?.pages.flatMap((page) => page.data);
  let lastNotification: NotificationType | undefined;
  notificationsData?.forEach((notification) => {
    lastNotification =
      lastNotification && notification && lastNotification.id > notification.id ? lastNotification : notification;
  });
  return lastNotification;
}

export function getMarkNotificationsMutationOptions(weavy: WeavyType, appIdOrUid?: string | number) {
  const options = {
    mutationFn: async ({ notificationId }: MutateMarkNotificationsVariables) => {
      const url = new URL(`/api/${appIdOrUid ? `apps/${appIdOrUid.toString()}/` : ""}notifications/mark`, weavy.url);
      if (notificationId) {
        url.searchParams.append("id", notificationId.toString());
      }
      await weavy.fetch(url, { method: "PUT" });
    },
    onMutate: (_variables: MutateMarkNotificationsVariables) => {
      const changedNotifications: Partial<NotificationType>[] = [];
      updateCacheItems<NotificationType>(
        weavy.queryClient,
        { queryKey: appIdOrUid ? ["notifications", "list", appIdOrUid] : ["notifications", "list"], exact: false },
        undefined,
        (item) => {
          changedNotifications.push({ id: item.id, is_unread: item.is_unread });
          item.is_unread = false;
        }
      );

      if (appIdOrUid && changedNotifications.length) {
        updateCacheItems<NotificationType>(
          weavy.queryClient,
          { queryKey: ["notifications", "list"], exact: false },
          (item) => Boolean(changedNotifications.find((n) => n.id === item.id && item.is_unread)),
          (item) => {
            item.is_unread = false;
          }
        );
      }

      if (!appIdOrUid) {
        updateCacheItemsCount<NotificationsResultType>(
          weavy.queryClient,
          { queryKey: ["notifications", "unread"], exact: false },
          () => 0
        );
      }

      updateCacheItemsCount<NotificationsResultType>(
        weavy.queryClient,
        {
          queryKey: appIdOrUid ? ["apps", "notifications", "unread", appIdOrUid] : ["apps", "notifications", "unread"],
          exact: false,
        },
        () => 0
      );

      return { changedNotifications } as MutateMarkNotificationContext;
    },
    onSuccess: async () => {
      if (appIdOrUid) {
        await weavy.queryClient.invalidateQueries({ queryKey: ["notifications", "unread"], exact: false });
      }
    },
    onSettled: async () => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["notifications", "list"], exact: false });
      await weavy.queryClient.invalidateQueries({ queryKey: ["notifications", "unread"], exact: false });
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps", "notifications", "unread"], exact: false });
    },
    onError: (error: Error, _variables: MutateMarkNotificationsVariables, _context?: MutateMarkNotificationContext) => {
      console.error(error.message);
    },
  };

  return options;
}

export function getMarkNotificationsMutation(weavy: WeavyType, appIdOrUid?: string | number) {
  return new MutationObserver(weavy.queryClient, getMarkNotificationsMutationOptions(weavy, appIdOrUid));
}

export function getMarkNotificationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ markAsRead, notificationId }: MutateMarkNotificationVariables) => {
      const url = `/api/notifications/${notificationId}/mark`;
      await weavy.fetch(url, { method: markAsRead ? "PUT" : "DELETE" });
    },
    onMutate: (variables: MutateMarkNotificationVariables) => {
      const itemsChanged: Map<number, NotificationType> = new Map();
      updateCacheItems<NotificationType>(
        weavy.queryClient,
        { queryKey: ["notifications", "list"], exact: false },
        variables.notificationId,
        (item) => {
          if (Boolean(item.is_unread) === variables.markAsRead) {
            itemsChanged.set(item.id, item);
          }
          item.is_unread = !variables.markAsRead;
        }
      );

      if (itemsChanged.size) {
        updateCacheItemsCount<NotificationsResultType>(
          weavy.queryClient,
          { 
            queryKey: ["notifications", "unread"], 
              predicate: (query) =>{
                  const typeMatch = query.queryKey[3] === "" || query.queryKey[3] === itemsChanged.values().next().value?.type;
                  return typeMatch
              },
            exact: false
          },
          (count) => Math.max(0, count + (variables.markAsRead ? -1 : 1))
        );

        itemsChanged.forEach((item) => {
          if (item.link?.app) {
            updateCacheItemsCount<NotificationsResultType>(
              weavy.queryClient,
              {
                queryKey: ["apps", "notifications", "unread"],
                predicate: (query) =>{
                  const appIdOrUidMatch = query.queryKey[3] === item.link?.app?.id || query.queryKey[3] === item.link?.app?.uid;
                  const typeMatch = query.queryKey[4] === "" || query.queryKey[4] === item.type;
                  return appIdOrUidMatch && typeMatch
                },
                exact: false,
              },
              (count) => Math.max(0, count + (variables.markAsRead ? -1 : 1))
            );
          }
        });
      }
    },
    onError: async (error: Error, variables: MutateMarkNotificationVariables) => {
      updateCacheItems<NotificationType>(
        weavy.queryClient,
        { queryKey: ["notifications", "list"], exact: false },
        variables.notificationId,
        (item) => {
          item.is_unread = variables.markAsRead;
        }
      );

      await weavy.queryClient.invalidateQueries({ queryKey: ["notifications", "unread"], exact: false });
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps", "notifications", "unread"], exact: false });
    },
  };

  return options;
}

export function getMarkNotificationMutation(weavy: WeavyType) {
  return new MutationObserver(weavy.queryClient, getMarkNotificationMutationOptions(weavy));
}

export function getUnreadOptions(
  weavy: WeavyType,
  type: NotificationTypes = NotificationTypes.All,
  appIdOrUid?: string | number,
  options: object = {}
) {
  const queryParams = new URLSearchParams({
    type: type,
    count_only: "true",
    unread: "true",
  });

  const url = `/api/${appIdOrUid ? `apps/${appIdOrUid.toString()}/` : ""}notifications?${queryParams.toString()}`;

  const queryKey = appIdOrUid ? ["apps", "notifications", "unread", appIdOrUid, type] : ["notifications", "unread", type];

  return getApiOptions<NotificationsResultType>(weavy, queryKey, url, options);
}
