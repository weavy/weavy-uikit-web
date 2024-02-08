import type { Mutation, MutationKey, MutationState, QueryClient } from "@tanstack/query-core";

export function updateMutationContext(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  variables: unknown,
  contextMutation: (context: Object) => void
) {
  const mutationCache = queryClient.getMutationCache();

  const mutation = mutationCache.find({
    mutationKey: mutationKey,
    predicate: (mutation) => {
      return mutation.state.variables === variables;
    },
  });

  if (mutation && mutation.state.context) {
    const newContext = { ...mutation.state.context };
    contextMutation(newContext);
    const newState = { ...mutation.state, context: newContext };
    //mutation.state.context = newContext;
    mutation.state = newState;

    mutationCache.notify({
      mutation,
      type: "updated",
      action: {
        type: "pending",
        context: mutation.state.context,
        variables: mutation.state.variables,
      },
    });
  }
}

export function removeMutation(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  filter: (mutation: Mutation<unknown, Error, unknown, unknown>) => boolean
) {
  const mutation = queryClient.getMutationCache().find({ mutationKey: mutationKey, exact: true, predicate: filter });

  if (mutation) {
    queryClient.getMutationCache().remove(mutation);
  }
}

export function removeMutations(queryClient: QueryClient, mutationKey: MutationKey) {
  const mutationCache = queryClient.getMutationCache();
  const mutations = mutationCache.findAll({ mutationKey: mutationKey, exact: true });

  mutations.forEach((mutation) => {
    mutationCache.remove(mutation);
  });
}

export function removeMutationByState(
  queryClient: QueryClient,
  mutationKey: MutationKey,
  mutationState: MutationState<unknown, Error, unknown, unknown>
) {
  return removeMutation(queryClient, mutationKey, (mutation) => {
    return (
      mutation.state.variables === mutationState.variables && mutation.state.submittedAt === mutationState.submittedAt
    );
  });
}
