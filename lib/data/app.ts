import { MutationKey } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import { AppUpProperties, ContextualTypes, type AppType } from "../types/app.types";
import { getApi, getApiMutation, getApiOptions } from "./api";

export function getAppOptions<T extends AppType = AppType>(weavy: WeavyType, uid: string, type: ContextualTypes = ContextualTypes.Unknown, appData?: AppUpProperties) {
  return type === ContextualTypes.Unknown
    ? getApiOptions<T>(weavy, ["apps", uid])
    : getApiOptions<T>(weavy, ["apps", uid], undefined, undefined, JSON.stringify({ type, ...appData }), "PUT");
}

export function getApp<T extends AppType = AppType>(weavy: WeavyType, uid: string, type: ContextualTypes = ContextualTypes.Unknown, appData?: AppUpProperties) {
  return type === ContextualTypes.Unknown
    ? getApi<T>(weavy, ["apps", uid])
    : getApi<T>(weavy, ["apps", uid], undefined, undefined, JSON.stringify({ type, ...appData }), "PUT");
}

export async function mutateApp<T extends AppType = AppType>(weavy: WeavyType, app: T, appData?: AppUpProperties) {
  const appMutation = getApiMutation<T>(weavy, ["apps", app.uid || app.id], undefined, undefined, "PATCH");
  const appResult = appMutation.mutate(JSON.stringify({ ...appData }))
  
  return appResult
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
        const response = await weavy.fetch(
          `/api/apps/${app.id}/${subscribe ? "subscribe" : "unsubscribe"}`,
          { method: "POST" }
        );
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
