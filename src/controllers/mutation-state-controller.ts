import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";

import {
  type QueryClient,
  type MutationState,
  type MutationFilters,
  type Mutation,
  type DefaultError,
  type MutationCache,
  replaceEqualDeep,
} from "@tanstack/query-core";

import { ContextConsumer } from "@lit/context";
import { WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { whenParentsDefined } from "src/utils/dom";

type MutationStateOptions<TResult = MutationState> = {
  filters?: MutationFilters;
  select?: (mutation: Mutation<unknown, DefaultError, unknown, unknown>) => TResult;
};

function getResult<TResult = MutationState>(
  mutationCache: MutationCache,
  options: MutationStateOptions<TResult>
): Array<TResult> {
  return mutationCache
    .findAll(options.filters)
    .map(
      (mutation): TResult =>
        (options.select
          ? options.select(mutation as Mutation<unknown, DefaultError, unknown, unknown>)
          : mutation.state) as TResult
    );
}

export class MutationStateController<TData, TError, TVariables, TContext> implements ReactiveController {
  host: ReactiveControllerHost;
  context?: ContextConsumer<{ __context__: WeavyContext }, LitElement>;
  whenContext?: Promise<void>;
  resolveContext?: (value: void | PromiseLike<void>) => void;
  result?: MutationState<TData, TError, TVariables, TContext>[];
  mutationCacheUnsubscribe?: () => void;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host;
    this.setContext();
  }

  async setContext() {
    this.whenContext = new Promise((r) => this.resolveContext = r)
    await whenParentsDefined(this.host as LitElement);
    this.context = new ContextConsumer(this.host as LitElement, { context: weavyContextDefinition, subscribe: true });
  }

  hostUpdate(): void {
    if(this.context?.value) {
      this.resolveContext?.();
    }
  }

  async trackMutationState(
    options: MutationStateOptions<MutationState<TData, TError, TVariables, TContext>>,
    queryClient?: QueryClient
  ) {
    if (!queryClient) {
      await this.whenContext;
      queryClient = this.context?.value?.queryClient;
    }

    if (!queryClient) {
      throw new Error("No QueryClient provided");
    }

    this.mutationCacheUnsubscribe?.();

    const mutationCache = queryClient.getMutationCache();
    
    this.result = getResult(mutationCache, options);
    //console.log("track mutations", options.filters?.mutationKey, this.result)

    this.mutationCacheUnsubscribe = mutationCache.subscribe((event) => {
      if (/added|removed|updated/.test(event.type)) {
        const nextResult = replaceEqualDeep(this.result, getResult(mutationCache, options));
        if (this.result !== nextResult) {
          //console.log("trackMutationState update", this.result, nextResult)

          this.result = nextResult;
          this.host.requestUpdate();
        }
      }
    });

    return this.result;
  }

  hostDisconnected() {
    // Clear the subscription when the host is disconnected
    this.mutationCacheUnsubscribe?.();
  }
}
