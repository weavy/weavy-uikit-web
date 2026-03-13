import { type WeavyType } from "../client/weavy";
import { UserOrAgentDetailType } from "../types/users.types";

export type MutateUserFollowProps = {
  follow: boolean;
};
export type MutateUserFollowContextType = { previousFollow: boolean | undefined; follow: boolean } | undefined;

export function getUserFollowMutationOptions(weavy: WeavyType, uid: number | string) {
  const queryClient = weavy.queryClient;
  const options = {
    mutationKey: ["users", uid, "follow"],
    mutationFn: async ({ follow }: MutateUserFollowProps) => {
      if (uid) {
        const response = await weavy.fetch(`/api/users/${uid}/${follow ? "follow" : "unfollow"}`, {
          method: "POST",
        });
        if (!response.ok) {
          throw await response.json();
        }
      } else {
        throw new Error(`Could not ${follow ? "follow" : "unfollow"} member ${uid}.`);
      }
    },
    onMutate: ({ follow }: MutateUserFollowProps) => {
      let previousFollow: boolean | undefined;

      queryClient.setQueryData(["users", uid], (user: UserOrAgentDetailType) => ({
        ...user,
        is_followed: follow,
      }));

      const mutationContext: MutateUserFollowContextType = {
        previousFollow,
        follow,
      };
      return mutationContext;
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey: ["users"], exact: false});
    },
  };
  return options;
}
