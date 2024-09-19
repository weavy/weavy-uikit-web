import {
  QueryFunctionContext,
  QueryKey,
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
  const PAGE_SIZE = 25;
  return {
    ...options,
    initialPageParam: 0,
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: ["notifications", "list", appIdOrUid, type],
    queryFn: async (opt: QueryFunctionContext<QueryKey, number | unknown>) => {
      const queryParams = new URLSearchParams({
        skip: opt.pageParam?.toString() || "0",
        top: PAGE_SIZE.toString(),
        type: type,
      });

      const url = `/api/${appIdOrUid ? `apps/${appIdOrUid.toString()}/` : ""}notifications?${queryParams.toString()}`;

      const response = await weavy.fetch(url);
      const result = await response.json();
      result.data = result.data || [];
      return result;
    },
    getNextPageParam: (lastPage, pages) => {
      if (lastPage.end && lastPage?.end < lastPage?.count) {
        return pages.length * PAGE_SIZE;
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
    onMutate: async (_variables: MutateMarkNotificationsVariables) => {
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
          { queryKey: ["notifications", "badge"], exact: false },
          () => 0
        );
      }

      updateCacheItemsCount<NotificationsResultType>(
        weavy.queryClient,
        {
          queryKey: appIdOrUid ? ["apps", "notifications", "badge", appIdOrUid] : ["apps", "notifications", "badge"],
          exact: false,
        },
        () => 0
      );

      return { changedNotifications } as MutateMarkNotificationContext;
    },
    onSuccess: () => {
      if (appIdOrUid) {
        weavy.queryClient.invalidateQueries({ queryKey: ["notifications", "badge"], exact: false });
      }
    },
    onSettled: () => {
      weavy.queryClient.invalidateQueries({ queryKey: ["notifications", "list"], exact: false });
      weavy.queryClient.invalidateQueries({ queryKey: ["notifications", "badge"], exact: false });
      weavy.queryClient.invalidateQueries({ queryKey: ["apps", "notifications", "badge"], exact: false });
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
    onMutate: async (variables: MutateMarkNotificationVariables) => {
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
          { queryKey: ["notifications", "badge"], exact: false },
          (count) => Math.max(0, count + (variables.markAsRead ? -1 : 1))
        );

        itemsChanged.forEach((item) => {
          if (item.link.app) {
            updateCacheItemsCount<NotificationsResultType>(
              weavy.queryClient,
              {
                queryKey: ["apps", "notifications", "badge"],
                predicate: (query) =>
                  query.queryKey[3] === item.link.app?.id || query.queryKey[3] === item.link.app?.uid,
                exact: false,
              },
              (count) => Math.max(0, count + (variables.markAsRead ? -1 : 1))
            );
          }
        });
      }
    },
    onError: (error: Error, variables: MutateMarkNotificationVariables) => {
      updateCacheItems<NotificationType>(
        weavy.queryClient,
        { queryKey: ["notifications", "list"], exact: false },
        variables.notificationId,
        (item) => {
          item.is_unread = variables.markAsRead;
        }
      );

      weavy.queryClient.invalidateQueries({ queryKey: ["notifications", "badge"], exact: false });
      weavy.queryClient.invalidateQueries({ queryKey: ["apps", "notifications", "badge"], exact: false });
    },
  };

  return options;
}

export function getMarkNotificationMutation(weavy: WeavyType) {
  return new MutationObserver(weavy.queryClient, getMarkNotificationMutationOptions(weavy));
}

export function getBadgeOptions(
  weavy: WeavyType,
  type: NotificationTypes = NotificationTypes.All,
  appIdOrUid?: string | number,
  options: object = {}
) {
  const queryParams = new URLSearchParams({
    type: type,
    countOnly: "true",
    unread: "true",
  });

  const url = `/api/${appIdOrUid ? `apps/${appIdOrUid.toString()}/` : ""}notifications?${queryParams.toString()}`;

  const queryKey = appIdOrUid ? ["apps", "notifications", "badge", appIdOrUid, type] : ["notifications", "badge", type];

  return getApiOptions<NotificationsResultType>(weavy, queryKey, url, options);
}
