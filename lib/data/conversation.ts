import { InfiniteData, MutationObserver, MutationObserverOptions } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import { AppType, AppTypeGuid, AppsResultType, AccessType, AppRef } from "../types/app.types";
import { removeCacheItem, updateCacheItem, updateCacheItems } from "../utils/query-cache";
import { getApi, getApiOptions } from "./api";
import { MemberType } from "../types/members.types";

export type MutateMarkConversationVariables = {
  appId: number;
  messageId?: number | null | undefined;
  userId: number | undefined;
};

export type MutateStarConversationVariables = {
  appId: number;
  star: boolean;
};

export type MutatePinConversationVariables = {
  appId: number;
  pin: boolean;
};

export type MutateLeaveConversationVariables = {
  appId: number;
  members: number[];
};

export type MutateRemoveConversationVariables = {
  appId: number;
};

export type MutateUpdateMemberVariables = {
  appId: number;
  userId: number;
  access: AccessType;
};

export type MutateAddMembersToConversationVariables = {
  appId: number;
  members: number[];
};

export type MutateUpdateConversationVariables = {
  appId: number;
  name?: string | null | undefined;
  blobId?: number | null | undefined;
  thumbnailUrl?: string | null | undefined;
};

export type MutateTrashConversationVariables = {
  appId: number;
};

export type MarkConversationMutationType = MutationObserver<void, Error, MutateMarkConversationVariables, void>;
export type StarConversationMutationType = MutationObserver<void, Error, MutateStarConversationVariables, void>;
export type PinConversationMutationType = MutationObserver<void, Error, MutatePinConversationVariables, void>;
export type LeaveConversationMutationType = MutationObserver<void, Error, MutateLeaveConversationVariables, void>;
export type RemoveConversationMutationType = MutationObserver<void, Error, MutateRemoveConversationVariables, void>;
export type UpdateMemberMutationType = MutationObserver<void, Error, MutateUpdateMemberVariables, void>;
export type AddMembersToConversationMutationType = MutationObserver<
  void,
  Error,
  MutateAddMembersToConversationVariables,
  void
>;
export type UpdateConversationMutationType = MutationObserver<AppType, Error, MutateUpdateConversationVariables, void>;
export type TrashConversationMutationType = MutationObserver<void, Error, MutateTrashConversationVariables, void>;

export function getMarkConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ appId, messageId }: MutateMarkConversationVariables) => {
      const url = messageId ? `/api/apps/${appId}/mark?messageId=${messageId}` : `/api/apps/${appId}/mark`;
      await weavy.fetch(url, { method: messageId ? "PUT" : "DELETE" });
    },
    onMutate: async (variables: MutateMarkConversationVariables) => {
      // update details and list cache
      await weavy.queryClient.cancelQueries({ queryKey: ["apps", variables.appId] });
      await weavy.queryClient.cancelQueries({ queryKey: ["apps", "list"], exact: false });
      await weavy.queryClient.cancelQueries({ queryKey: ["members", variables.appId] });

      weavy.queryClient.setQueryData(["apps", variables.appId], (app: AppType) =>
        app ? { ...app, is_unread: !variables.messageId || variables.messageId < app.last_message.id } : app
      );

      updateCacheItems(
        weavy.queryClient,
        { queryKey: ["apps", "list"], exact: false },
        variables.appId,
        (item: AppType) => {
          item.is_unread = !variables.messageId || variables.messageId < item.last_message.id;
        }
      );

      // Update members after apps
      if (variables.userId) {
        updateCacheItem(weavy.queryClient, ["members", variables.appId], variables.userId, (member: MemberType) => {
          if (variables.messageId) {
            member.marked_at = new Date().toISOString();
            member.marked_id = variables.messageId
          } else {
            member.marked_at = undefined;
            member.marked_id = undefined
          }
        })
      }
    },
    onError: (error: Error, variables: MutateMarkConversationVariables) => {
      console.error(error.message);
      updateCacheItems(
        weavy.queryClient,
        { queryKey: ["apps", "list"], exact: false },
        variables.appId,
        (item: AppType) => {
          item.is_unread = !item.is_unread;
        }
      );
    },
    onSettled: async (data: void | undefined, error: Error | null, variables: MutateMarkConversationVariables) => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps", variables.appId] });
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps", "list"], exact: false });
      await weavy.queryClient.invalidateQueries({ queryKey: ["members", variables.appId] })
    },
  };

  return options;
}

export function getStarConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ appId, star }: MutateStarConversationVariables) => {
      await weavy.fetch(`/api/apps/${appId}/stars`, { method: star ? "POST" : "DELETE" });
    },
    onMutate: (variables: MutateStarConversationVariables) => {
      updateCacheItems(
        weavy.queryClient,
        { queryKey: ["apps", "list"], exact: false },
        variables.appId,
        (item: AppType) => {
          item.is_starred = variables.star;
        }
      );
    },
    onError: (error: Error, variables: MutateStarConversationVariables) => {
      console.error(error.message);
      updateCacheItems(
        weavy.queryClient,
        { queryKey: ["apps", "list"], exact: false },
        variables.appId,
        (item: AppType) => {
          item.is_starred = !variables.star;
        }
      );
    },
  };

  return options;
}

export function getPinConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ appId, pin }: MutatePinConversationVariables) => {
      await weavy.fetch(`/api/apps/${appId}/pin`, { method: pin ? "PUT" : "DELETE" });
    },
    onMutate: (variables: MutatePinConversationVariables) => {
      updateCacheItems(
        weavy.queryClient,
        { queryKey: ["apps", "list"], exact: false },
        variables.appId,
        (item: AppType) => {
          item.is_pinned = variables.pin;
        }
      );
    },
    onSettled: async () => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps"] });
    },
  };

  return options;
}

export function getLeaveConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ appId, members }: MutateLeaveConversationVariables) => {
      await weavy.fetch(`/api/apps/${appId}/members/${members.join(",")}`, { method: "DELETE" });
    },
    onMutate: (variables: MutateLeaveConversationVariables) => {
      removeCacheItem(weavy.queryClient, ["apps", "list"], variables.appId);
    },
    onSuccess: (data: void | undefined, variables: MutateLeaveConversationVariables) => {
      weavy.queryClient.removeQueries({ queryKey: ["apps", variables.appId]})
      weavy.queryClient.removeQueries({ queryKey: ["members", variables.appId]})
    },
    onSettled: async () => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps"]})
      await weavy.queryClient.invalidateQueries({ queryKey: ["members"]})
    }
  };

  return options;
}

export function getRemoveConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ appId }: MutateRemoveConversationVariables) => {
      await weavy.fetch(`/api/apps/${appId}/remove`, { method: "POST" });
    },
    onMutate: (variables: MutateRemoveConversationVariables) => {
      removeCacheItem(weavy.queryClient, ["apps", "list"], variables.appId);
    },
    onSettled: async () => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps"]})
    }
  };

  return options;
}

export function getUpdateMemberMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ appId, userId, access }: MutateUpdateMemberVariables) => {
      await weavy.fetch(`/api/apps/${appId}/members/${userId}`, { method: "PUT", body: JSON.stringify({ access }) });
    },
    onSettled: async (data: void | undefined, error: Error | null, variables: MutateUpdateMemberVariables) => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps"] })
      await weavy.queryClient.invalidateQueries({ queryKey: ["members", variables.appId] })
    }
  };

  return options;
}

export function getAddMembersToConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ appId, members }: MutateAddMembersToConversationVariables) => {
      await weavy.fetch(`/api/apps/${appId}/members`, {
        method: "PUT",
        body: JSON.stringify(
          members.map((id: number) => {
            return { id: id, access: "write" };
          })
        ),
      });
    },
    onSettled: async (data: void | undefined, error: Error | null, variables: MutateAddMembersToConversationVariables) => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps"] })
      await weavy.queryClient.invalidateQueries({ queryKey: ["members", variables.appId] })
    }
  };

  return options;
}

export function getUpdateConversationMutationOptions(weavy: WeavyType): MutationObserverOptions<AppType, Error, MutateUpdateConversationVariables, void> {
  const options = {
    mutationFn: async ({ appId, name, blobId }: MutateUpdateConversationVariables) => {
      const response = await weavy.fetch(`/api/apps/${appId}`, {
        method: "PATCH",
        body: JSON.stringify({
          name: name,
          picture: blobId,
        }),
      });
      return await response.json() as AppType;
    },
    onMutate: (variables: MutateUpdateConversationVariables) => {
      const modifyAppItem = (item: AppType) => {
        if (typeof variables.name === "string") {
          item.name = variables.name;
        }

        if (typeof variables?.thumbnailUrl === "string") {
          item.avatar_url = variables.thumbnailUrl;
        }
      };

      updateCacheItem(weavy.queryClient, ["apps", variables.appId], undefined, modifyAppItem);
      updateCacheItems(weavy.queryClient, { queryKey: ["apps", "list"], exact: false }, variables.appId, modifyAppItem);
    },
  };

  return options;
}

export function getTrashConversationMutationOptions(weavy: WeavyType) {
  const options = {
    mutationFn: async ({ appId }: MutateTrashConversationVariables) => {
      await weavy.fetch(`/api/apps/${appId}/trash`, { method: "POST" });
    },
    onMutate: (variables: MutateTrashConversationVariables) => {
      removeCacheItem(weavy.queryClient, ["apps", "list"], variables.appId);
    },
    onSettled: async () => {
      await weavy.queryClient.invalidateQueries({ queryKey: ["apps"]})
    }
  };

  return options;
}

export function getMarkConversationMutation(weavy: WeavyType): MarkConversationMutationType {
  return new MutationObserver(weavy.queryClient, getMarkConversationMutationOptions(weavy));
}

export function getStarConversationMutation(weavy: WeavyType): StarConversationMutationType {
  return new MutationObserver(weavy.queryClient, getStarConversationMutationOptions(weavy));
}

export function getPinConversationMutation(weavy: WeavyType): PinConversationMutationType {
  return new MutationObserver(weavy.queryClient, getPinConversationMutationOptions(weavy));
}

export function getLeaveConversationMutation(weavy: WeavyType): LeaveConversationMutationType {
  return new MutationObserver(weavy.queryClient, getLeaveConversationMutationOptions(weavy));
}

export function getRemoveConversationMutation(weavy: WeavyType): RemoveConversationMutationType {
  return new MutationObserver(weavy.queryClient, getRemoveConversationMutationOptions(weavy));
}

export function getUpdateMemberMutation(weavy: WeavyType): UpdateMemberMutationType {
  return new MutationObserver(weavy.queryClient, getUpdateMemberMutationOptions(weavy));
}

export function getAddMembersToConversationMutation(weavy: WeavyType): AddMembersToConversationMutationType {
  return new MutationObserver(weavy.queryClient, getAddMembersToConversationMutationOptions(weavy));
}

export function getUpdateConversationMutation(weavy: WeavyType): UpdateConversationMutationType {
  return new MutationObserver(weavy.queryClient, getUpdateConversationMutationOptions(weavy));
}

export function getTrashConversationMutation(weavy: WeavyType): TrashConversationMutationType {
  return new MutationObserver(weavy.queryClient, getTrashConversationMutationOptions(weavy));
}

export function getConversationOptions(
  weavy: WeavyType,
  conversationId: number,
  types: AppTypeGuid[] | null = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat],
  member?: string
) {
  return getApiOptions<AppType>(weavy, ["apps", conversationId], undefined, {
    initialData: () => {
      // Use data from app list as initial data for app details
      return weavy?.queryClient
        .getQueryData<InfiniteData<AppsResultType>>(["apps", "list", types, member])
        ?.pages.flatMap((cPage) => cPage.data)
        .find((c) => c?.id === conversationId);
    },
  });
}

export function getConversation(
  weavy: WeavyType,
  conversationId: number,
  types: AppTypeGuid[] | null = [AppTypeGuid.ChatRoom, AppTypeGuid.PrivateChat],
  member?: string
) {
  return getApi<AppType>(weavy, ["apps", conversationId], undefined, {
    initialData: () => {
      // Use data from app list as initial data for app details
      return weavy?.queryClient
        .getQueryData<InfiniteData<AppsResultType>>(["apps", "list", types, member])
        ?.pages.flatMap((cPage) => cPage.data)
        .find((c) => c?.id === conversationId);
    },
  });
}

export async function resolveAppWithType(
  weavy: WeavyType,
  app: AppRef | AppType | number,
  types: AppTypeGuid[],
  member?: string
): Promise<AppType | undefined> {
  let checkApp: AppType;

  // TODO: Replace with a compatible getApp instead of getConversation
  if (typeof app === "number") {
    checkApp = await getConversation(weavy, app, types, member);
  } else if (typeof app.id === "number" && !app.type) {
    checkApp = await getConversation(weavy, app.id, types, member);
  } else if (typeof app.type === "string") {
    checkApp = app as AppType;
  } else {
    return undefined;
  }
  return types.includes(checkApp.type) ? checkApp : undefined;
}
