import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";

import {
  type QueryClient,
  type MutationObserverResult,
  type MutationObserverOptions,
  MutationObserver,
  replaceEqualDeep,
} from "@tanstack/query-core";

import { ContextConsumer } from "@lit/context";
import { WeavyContext, weavyContextDefinition } from "../client/context-definition";
import { whenParentsDefined } from "../utils/dom";

export class MutationController<TData, TError, TVariables, TContext> implements ReactiveController {
  host: ReactiveControllerHost;
  context?: ContextConsumer<{ __context__: WeavyContext }, LitElement>;
  whenContext?: Promise<void>;
  resolveContext?: (value: void | PromiseLike<void>) => void;
  observer?: MutationObserver<TData, TError, TVariables, TContext>;
  result?: MutationObserverResult<TData, TError, TVariables, TContext>;

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

  async trackMutation(options: MutationObserverOptions<TData, TError, TVariables, TContext>, queryClient?: QueryClient) {
    if (!queryClient) {
      await this.whenContext;
      queryClient = this.context?.value?.queryClient;
    }

    if (!queryClient) {
      throw new Error("No QueryClient provided");
    }

    this.observeUnsubscribe?.();

    this.observer = new MutationObserver(queryClient, { ...options });

    this.result = this.observer.getCurrentResult();

    this.observeUnsubscribe ??= this.observer.subscribe(() => {
      if (this.observer) {
        const nextResult = replaceEqualDeep(this.result, this.observer.getCurrentResult());
        if (this.result !== nextResult) {
          //console.log("update", this.result, nextResult)
          this.result = nextResult;
          this.host.requestUpdate();
        }
      }
    });

    return this.observer;
  }

  untrackMutation() {
    this.observeUnsubscribe?.();
    this.observeUnsubscribe = undefined;
    this.result = undefined;
    this.observer = undefined;
    this.host.requestUpdate();
  }

  get mutate() {
    return this.observer!.mutate;
  }

  hostDisconnected() {
    // Clear the subscription when the host is disconnected
    this.observeUnsubscribe?.();
  }
}
