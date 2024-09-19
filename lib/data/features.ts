import { type WeavyType } from "../client/weavy";

/// GET chat app
export async function getFeatures<T>(weavy: WeavyType, type: string) {
  if (!weavy) {
    throw new Error("getFeatures must be used within a WeavyContext");
  }

  const queryClient = weavy.queryClient;

  return await queryClient.fetchQuery<T>({
    queryKey: ["features", type],
    queryFn: async () => {
      const response = await weavy.fetch("/api/features/" + type);
      return await response.json();
    },
  });
}
