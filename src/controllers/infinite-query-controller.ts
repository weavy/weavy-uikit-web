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
import { WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { whenParentsDefined } from "../utils/dom";

export class InfiniteQueryController<TData = unknown> implements ReactiveController {
  host: ReactiveControllerHost;
  context?: ContextConsumer<{ __context__: WeavyContext }, LitElement>;
  whenContext?: Promise<void>;
  resolveContext?: (value: void | PromiseLike<void>) => void;
  observer?: InfiniteQueryObserver<TData>;

  private _result?: InfiniteQueryObserverResult<InfiniteData<TData>>;

  get result() {
    return (
      this._result && this.observer ? this.observer.trackResult(this._result) : undefined
    ) as InfiniteQueryObserverResult<InfiniteData<TData>>;
  }

  private observeUnsubscribe?: () => void;

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

  async trackInfiniteQuery(
    infiniteQueryOptions: InfiniteQueryObserverOptions<TData, Error, InfiniteData<TData>>,
    queryClient?: QueryClient
  ) {
    if (!queryClient) {
      await this.whenContext;
      queryClient = this.context?.value?.queryClient;
    }

    if (!queryClient) {
      throw new Error("No QueryClient provided");
    }

    this.observeUnsubscribe?.();

    const observer = new InfiniteQueryObserver<TData>(queryClient, infiniteQueryOptions);
    //console.log("trackInfiniteQuery", infiniteQueryOptions)

    this.observer = observer;
    this._result = observer.getOptimisticResult(
      observer.options as DefaultedInfiniteQueryObserverOptions<TData, Error, InfiniteData<TData>>
    );

    this.observeUnsubscribe = observer.subscribe(() => {
      const nextResult = replaceEqualDeep(this.result, observer.getCurrentResult());
      if (nextResult !== this._result) {
        //console.log("update", nextResult)
        this._result = nextResult;
        this.host.requestUpdate();
      }
    });

    // Update result to make sure we did not miss any query updates
    // between creating the observer and subscribing to it.
    observer.updateResult();
  }

  untrackInfiniteQuery() {
    this.observeUnsubscribe?.();
    this.observeUnsubscribe = undefined;
    this._result = undefined;
    this.observer = undefined;
  }

  hostDisconnected() {
    // Clear the subscription when the host is disconnected
    this.observeUnsubscribe?.();
  }
}
