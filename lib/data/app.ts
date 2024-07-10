import { MutationKey } from "@tanstack/query-core";
import { type WeavyContextType } from "../client/weavy";
import { AppUpProperties, ContextualTypes, type AppType } from "../types/app.types";
import { getApi, getApiOptions } from "./api";

export function getAppOptions<T = AppType>(weavyContext: WeavyContextType, uid: string, type: ContextualTypes, appData?: AppUpProperties) {
  return type === ContextualTypes.Unknown
    ? getApiOptions<T>(weavyContext, ["apps", uid])
    : getApiOptions<T>(weavyContext, ["apps", uid], undefined, undefined, JSON.stringify({ type, ...appData }), "PUT");
}

export function getApp<T = AppType>(weavyContext: WeavyContextType, uid: string, type: ContextualTypes, appData?: AppUpProperties) {
  return type === ContextualTypes.Unknown
    ? getApi<T>(weavyContext, ["apps", uid])
    : getApi<T>(weavyContext, ["apps", uid], undefined, undefined, JSON.stringify({ type, ...appData }), "PUT");
}

export type MutateAppSubscribeProps = {
  subscribe: boolean;
};

export type MutateAppSubscribeContextType = { previousSubscribe: boolean | undefined; subscribe: boolean } | undefined;

export function getAppSubscribeMutationOptions(weavyContext: WeavyContextType, app: AppType) {
  const queryClient = weavyContext.queryClient;

  const mutationKey: MutationKey = ["apps", app.uid];

  const options = {
    mutationFn: async ({ subscribe }: MutateAppSubscribeProps) => {
      if (app.id >= 1) {
        const response = await weavyContext.post(
          `/api/apps/${app.id}/${subscribe ? "subscribe" : "unsubscribe"}`,
          "POST",
          ""
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
