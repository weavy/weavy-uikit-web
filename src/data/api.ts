import { type QueryKey } from "@tanstack/query-core";
import { type WeavyContext } from "../client/weavy-context";

export function getApiOptions<T>(weavyContext: WeavyContext, apiKey: QueryKey, apiPath?: string) {
  return {
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: apiKey,
    queryFn: async () => {
      const response = await weavyContext.get("/api/" + (apiPath ? apiPath : apiKey.join("/")));
      return (await response.json()) as T;
    },
  };
}

// GET app
export async function getApi<T>(weavyContext: WeavyContext, apiKey: QueryKey, apiPath?: string) {
  const queryClient = weavyContext.queryClient;
  return await queryClient.fetchQuery<T>(getApiOptions(weavyContext, apiKey, apiPath));
}
