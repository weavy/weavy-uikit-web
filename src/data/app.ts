import { MutationKey } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";
import { AppType } from "../types/app.types";

/// GET app
export async function getApp<T>(weavyContext: WeavyContext, appId: string) {
  if (!weavyContext) {
    throw new Error("get app must be used within a WeavyContext");
  }

  const queryClient = weavyContext.queryClient;

  return await queryClient.fetchQuery<T>({
    queryKey: ["apps", appId],
    queryFn: async () => {
      const response = await weavyContext.get("/api/apps/" + appId);
      return await response.json();
    },
  });
}

/// GET app by id
export async function getAppById<T>(weavyContext: WeavyContext, id: number) {
  if (!weavyContext) {
    throw new Error("get app must be used within a WeavyContext");
  }

  const queryClient = weavyContext.queryClient;

  return await queryClient.fetchQuery<T>({
    queryKey: ["apps", id],
    queryFn: async () => {
      const response = await weavyContext.get("/api/apps/" + id);
      return await response.json();
    },
  });
}

export type MutateAppSubscribeProps = {
  subscribe: boolean;
};

export type MutateAppSubscribeContextType = { previousSubscribe: boolean | undefined; subscribe: boolean } | undefined;

export function getAppSubscribeMutationOptions(weavyContext: WeavyContext, app: AppType) {
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
        return response.json();
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
    onSuccess: (data: AppType) => {
      queryClient.setQueryData(
        mutationKey,
        (mApp: AppType) => {
          return { ...mApp, ...data };
        },
        { updatedAt: Date.now() }
      );
      queryClient.invalidateQueries({ queryKey: mutationKey, exact: true });
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
