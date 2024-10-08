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
  whenContext?: Promise<void>;
  resolveContext?: (value: void | PromiseLike<void>) => void;
  observer?: QueryObserver<TData>;

  private _result?: QueryObserverResult<TData>;

  get result() {
    return (
      this._result && this.observer ? this.observer.trackResult(this._result) : undefined
    ) as QueryObserverResult<TData>;
  }

  private observerUnsubscribe?: () => void;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host;
    this.setContext();
  }

  async setContext() {
    this.whenContext = new Promise((r) => (this.resolveContext = r));
    await whenParentsDefined(this.host as LitElement);
    this.context = new ContextConsumer(this.host as LitElement, { context: WeavyContext, subscribe: true });
  }

  hostUpdate(): void {
    if (this.context?.value) {
      this.resolveContext?.();
    }
  }

  async trackQuery(queryOptions: QueryObserverOptions<TData>, optimistic: boolean = true, queryClient?: QueryClient) {
    if (!queryClient) {
      await this.whenContext;
      queryClient = this.context?.value?.queryClient;
    }

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
    if (this.observer) {
      if (optimistic) {
        this._result = this.observer.getOptimisticResult(this.observer.options as DefaultedQueryObserverOptions<TData>);
      } else {
        this._result = undefined;
      }

      this.observerUnsubscribe = this.observer.subscribe(() => {
        if (this.observer) {
          const nextResult = replaceEqualDeep(this.result, this.observer.getCurrentResult());
          if (nextResult !== this._result) {
            //console.log("update", queryOptions.queryKey, nextResult)
            this._result = nextResult;
            this.host.requestUpdate();
          }
        }
      });

      // Update result to make sure we did not miss any query updates
      // between creating the observer and subscribing to it.
      this.observer.updateResult();
      this.host.requestUpdate();
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
