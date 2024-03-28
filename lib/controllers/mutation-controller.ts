import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";

import {
  type QueryClient,
  type MutationObserverResult,
  type MutationObserverOptions,
  MutationObserver,
  replaceEqualDeep,
} from "@tanstack/query-core";

import { ContextConsumer } from "@lit/context";
import { type WeavyContextType, weavyContextDefinition } from "../client/context-definition";
import { whenParentsDefined } from "../utils/dom";

export class MutationController<TData, TError, TVariables, TContext> implements ReactiveController {
  host: ReactiveControllerHost;
  context?: ContextConsumer<{ __context__: WeavyContextType }, LitElement>;
  whenContext?: Promise<void>;
  resolveContext?: (value: void | PromiseLike<void>) => void;
  observer?: MutationObserver<TData, TError, TVariables, TContext>;
  result?: MutationObserverResult<TData, TError, TVariables, TContext>;

  private observerUnsubscribe?: () => void;

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

    this.observerUnsubscribe?.();

    this.observer = new MutationObserver(queryClient, { ...options });

    this.observerSubscribe();

    return this.observer;
  }

  observerSubscribe() {
    if (this.observer) {
      this.result = this.observer.getCurrentResult();

      this.observerUnsubscribe ??= this.observer.subscribe(() => {
        if (this.observer) {
          const nextResult = replaceEqualDeep(this.result, this.observer.getCurrentResult());
          if (this.result !== nextResult) {
            //console.log("update", this.result, nextResult)
            this.result = nextResult;
            this.host.requestUpdate();
          }
        }
      });

      this.host.requestUpdate();
    }
  }

  untrackMutation() {
    this.observerUnsubscribe?.();
    this.observerUnsubscribe = undefined;
    this.result = undefined;
    this.observer = undefined;
    this.host.requestUpdate();
  }

  get mutate() {
    return this.observer!.mutate;
  }

  hostConnected() {
    this.observerSubscribe();
  }

  hostDisconnected() {
    // Clear the subscription when the host is disconnected
    this.observerUnsubscribe?.();
  }
}
