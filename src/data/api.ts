import { QueryOptions, type QueryKey } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";

export function getApiOptions<T>(weavyContext: WeavyContext, apiKey: QueryKey, apiPath?: string, options?: QueryOptions<T>) {
  return {
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: apiKey,
    queryFn: async () => {
      const response = await weavyContext.get("/api/" + (apiPath ? apiPath : apiKey.join("/")));
      return (await response.json()) as T;
    },
    ...options
  };
}

// GET app
export async function getApi<T>(weavyContext: WeavyContext, apiKey: QueryKey, apiPath?: string, options?: QueryOptions<T>, noCache: boolean = false) {
  const queryClient = weavyContext.queryClient;
  if (noCache) {
    return await queryClient.fetchQuery<T>(getApiOptions(weavyContext, apiKey, apiPath, options));
  } else {
    return await queryClient.ensureQueryData<T>(getApiOptions(weavyContext, apiKey, apiPath, options));
  }
}
