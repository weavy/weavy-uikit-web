import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import {
  type QueryClient,
  type QueryObserverResult,
  type QueryObserverOptions,
  type DefaultedQueryObserverOptions,
  QueryObserver,
  replaceEqualDeep,
} from "@tanstack/query-core";

import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";

export class QueryController<TData = unknown> implements ReactiveController {
  host: ReactiveControllerHost;
  context?: ContextConsumer<{ __context__: WeavyType }, LitElement>;
  whenContext?: Promise<WeavyType>;
  resolveContext?: (value: WeavyType | PromiseLike<WeavyType>) => void;
  queryClient?: QueryClient;
  whenQueryClient: Promise<QueryClient>;
  resolveQueryClient?: (value: QueryClient | PromiseLike<QueryClient>) => void;
  observer?: QueryObserver<TData>;

  private _result?: QueryObserverResult<TData>;

  get result() {
    return (
      this._result && this.observer ? this.observer.trackResult(this._result) : { isPending: true }
    ) as QueryObserverResult<TData>;
  }

  private observerUnsubscribe?: () => void;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host;
    this.whenContext = new Promise((r) => (this.resolveContext = r));
    this.whenQueryClient = new Promise((r) => (this.resolveQueryClient = r));
    this.setContext();
  }

  async setContext() {
    await whenParentsDefined(this.host as LitElement);
    this.context = new ContextConsumer(this.host as LitElement, {
      context: WeavyContext,
      subscribe: true,
      callback: (weavy) => {
        if (weavy) {
          this.resolveContext?.(weavy);
          this.queryClient = weavy.queryClient;
          this.resolveQueryClient?.(weavy.queryClient);
        }
      },
    });
  }

  async trackQuery(queryOptions: QueryObserverOptions<TData>, optimistic: boolean = true) {
    const queryClient = await this.whenQueryClient;

    if (!queryClient) {
      throw new Error("No QueryClient provided");
    }
    
    this.observerUnsubscribe?.();

    const observer = new QueryObserver(queryClient, queryOptions);
    //console.log("trackQuery", queryOptions)

    this.observer = observer;
    this.observerSubscribe(optimistic);
  }

  observerSubscribe(optimistic: boolean = true) {
    if (this.queryClient && this.observer) {
      if (optimistic) {
        this._result = this.observer.getOptimisticResult(this.observer.options as DefaultedQueryObserverOptions<TData>);
      } else {
        this._result = this.observer.getCurrentResult();
      }

      this.observerUnsubscribe = this.observer.subscribe(() => {
        if (this.observer) {
          // REVIEW: The replaceEqualDeep might now be redundant because of updates in Tanstack
          const nextResult = replaceEqualDeep(this.result, this.observer.getCurrentResult());
          if (nextResult !== this._result) {
            //console.log("update?", this.observer.options.queryKey, nextResult, nextResult !== this._result)
            this._result = nextResult;
            this.host.requestUpdate();
          }
        }
      });

      // Update result to make sure we did not miss any query updates
      // between creating the observer and subscribing to it.
      this.observer.updateResult();
      this.host.requestUpdate();

      let whenUpdated;
      if (optimistic) {
        whenUpdated = this.observer.fetchOptimistic(this.observer.options);
      } else {
        whenUpdated = this.queryClient
          .getQueryCache()
          .get((this.observer.options as DefaultedQueryObserverOptions<TData>).queryHash)?.promise;
      }
      whenUpdated
        ?.catch(() => {})
        .finally(() => {
          // `.updateResult()` will trigger the subscribe callback
          this.observer?.updateResult();
        });
    }
  }

  untrackQuery() {
    this.observerUnsubscribe?.();
    this.observerUnsubscribe = undefined;
    this._result = undefined;
    this.observer = undefined;
    this.host.requestUpdate();
  }

  hostConnected() {
    this.observerSubscribe();
  }

  hostDisconnected() {
    // Clear the subscription when the host is disconnected
    this.observerUnsubscribe?.();
  }
}
