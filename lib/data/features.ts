import { type WeavyContextType } from "../client/weavy";

/// GET chat app
export async function getFeatures<T>(weavyContext: WeavyContextType, type: string) {
  if (!weavyContext) {
    throw new Error("getFeatures must be used within a WeavyContext");
  }

  const queryClient = weavyContext.queryClient;

  return await queryClient.fetchQuery<T>({
    queryKey: ["features", type],
    queryFn: async () => {
      const response = await weavyContext.get("/api/features/" + type);
      return await response.json();
    },
  });
}
