import type { QueryOptions, QueryKey, FetchQueryOptions, QueryObserverOptions } from "@tanstack/query-core";
import { type WeavyContextType } from "../client/weavy-context";
import type { HttpMethodType } from "../types/http.types";

export function getApiOptions<T>(weavyContext: WeavyContextType, apiKey: QueryKey, apiPath?: string, options?: QueryOptions<T>, body?: BodyInit, method: HttpMethodType = "GET") {
  return <QueryObserverOptions<T>> {
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: apiKey,
    queryFn: async () => {
      const response = await weavyContext.post((apiPath ? apiPath : "/api/" + apiKey.join("/")), method, body);

      if (response.ok){
        return (await response.json()) as T;
      } else{      
        throw new Error(`Error calling ${(apiPath ? apiPath : "/api/" + apiKey.join("/"))}`);
      }
      
    },
    ...options
  };
}

// GET app
export async function getApi<T>(weavyContext: WeavyContextType, apiKey: QueryKey, apiPath?: string, options?: QueryOptions<T>, body?: BodyInit, method: HttpMethodType = "GET", noCache: boolean = false) {
  const queryClient = weavyContext.queryClient;
  const apiOptions = getApiOptions(weavyContext, apiKey, apiPath, options, body, method) as FetchQueryOptions<T>;
  
  if (noCache) {
    return await queryClient.fetchQuery<T>(apiOptions);
  } else {
    return await queryClient.ensureQueryData<T>(apiOptions);
  }
}
