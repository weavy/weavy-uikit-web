import type { QueryOptions, QueryKey, FetchQueryOptions, QueryObserverOptions } from "@tanstack/query-core";
import { type WeavyType } from "../client/weavy";
import type { HttpMethodType } from "../types/http.types";

export function getApiOptions<T>(weavy: WeavyType, apiKey: QueryKey, apiPath?: string, options?: QueryOptions<T>, body?: BodyInit, method: HttpMethodType = "GET") {
  return <QueryObserverOptions<T>> {
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey: apiKey,
    queryFn: async () => {
      //console.log("API", (apiPath ? apiPath : "/api/" + apiKey.join("/")));
      const response = await weavy.post((apiPath ? apiPath : "/api/" + apiKey.join("/")), method, body);

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
export async function getApi<T>(weavy: WeavyType, apiKey: QueryKey, apiPath?: string, options?: QueryOptions<T>, body?: BodyInit, method: HttpMethodType = "GET", noCache: boolean = false) {
  const queryClient = weavy.queryClient;
  const apiOptions = getApiOptions(weavy, apiKey, apiPath, options, body, method) as FetchQueryOptions<T>;
  
  if (noCache) {
    return await queryClient.fetchQuery<T>(apiOptions);
  } else {
    return await queryClient.ensureQueryData<T>(apiOptions);
  }
}
