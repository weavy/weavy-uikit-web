import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";
import {
  type QueryClient,
  type InfiniteQueryObserverResult,
  type InfiniteQueryObserverOptions,
  type InfiniteData,
  type DefaultedInfiniteQueryObserverOptions,
  InfiniteQueryObserver,
  replaceEqualDeep,
} from "@tanstack/query-core";

import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";

export class InfiniteQueryController<TData = unknown> implements ReactiveController {
  host: ReactiveControllerHost;
  context?: ContextConsumer<{ __context__: WeavyType }, LitElement>;
  whenContext?: Promise<void>;
  resolveContext?: (value: void | PromiseLike<void>) => void;
  observer?: InfiniteQueryObserver<TData>;

  private _result?: InfiniteQueryObserverResult<InfiniteData<TData>>;

  get result() {
    return (
      this._result && this.observer ? this.observer.trackResult(this._result) : undefined
    ) as InfiniteQueryObserverResult<InfiniteData<TData>>;
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

  async trackInfiniteQuery(
    infiniteQueryOptions: InfiniteQueryObserverOptions<TData, Error, InfiniteData<TData>>,
    optimistic: boolean = true,
    queryClient?: QueryClient
  ) {
    if (!queryClient) {
      await this.whenContext;
      queryClient = this.context?.value?.queryClient;
    }

    if (!queryClient) {
      throw new Error("No QueryClient provided");
    }

    this.observerUnsubscribe?.();

    const observer = new InfiniteQueryObserver<TData>(queryClient, infiniteQueryOptions);
    //console.log("trackInfiniteQuery", infiniteQueryOptions)

    this.observer = observer;
    this.observerSubscribe(optimistic);
  }

  observerSubscribe(optimistic: boolean = true) {
    if (this.observer) {
      if (optimistic) {
        this._result = this.observer.getOptimisticResult(
          this.observer.options as DefaultedInfiniteQueryObserverOptions<TData, Error, InfiniteData<TData>>
        );
      } else {
        this._result = undefined;
      }

      this.observerUnsubscribe = this.observer.subscribe(() => {
        if (this.observer) {
          const nextResult = replaceEqualDeep(this.result, this.observer.getCurrentResult());
          if (nextResult !== this._result) {
            //console.log("update", nextResult)
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

  untrackInfiniteQuery() {
    this.observerUnsubscribe?.();
    this.observerUnsubscribe = undefined;
    this._result = undefined;
    this.observer = undefined;
  }

  hostConnected() {
    this.observerSubscribe();
  }

  hostDisconnected() {
    // Clear the subscription when the host is disconnected
    this.observerUnsubscribe?.();
  }
}
