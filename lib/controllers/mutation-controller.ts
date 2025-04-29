import { LitElement, ReactiveController, ReactiveControllerHost } from "lit";

import {
  type QueryClient,
  type MutationObserverResult,
  type MutationObserverOptions,
  MutationObserver,
  replaceEqualDeep,
  MutateOptions,
} from "@tanstack/query-core";

import { ContextConsumer } from "@lit/context";
import { type WeavyType, WeavyContext } from "../contexts/weavy-context";
import { whenParentsDefined } from "../utils/dom";

export class MutationController<TData, TError, TVariables, TContext> implements ReactiveController {
  host: ReactiveControllerHost;
  context?: ContextConsumer<{ __context__: WeavyType }, LitElement>;
  whenContext: Promise<void>;
  resolveContext?: (value: void | PromiseLike<void>) => void;
  whenObserver: Promise<MutationObserver<TData, TError, TVariables, TContext>>;
  resolveObserver?: (value: MutationObserver<TData, TError, TVariables, TContext> | PromiseLike<MutationObserver<TData, TError, TVariables, TContext>>) => void;
  observer?: MutationObserver<TData, TError, TVariables, TContext>;
  result?: MutationObserverResult<TData, TError, TVariables, TContext>;

  private observerUnsubscribe?: () => void;

  constructor(host: ReactiveControllerHost) {
    host.addController(this);
    this.host = host;

    this.whenContext = new Promise((r) => this.resolveContext = r);
    this.whenObserver = new Promise((r) => this.resolveObserver = r);

    void this.setContext();
  }

  async setContext() {
    await whenParentsDefined(this.host as LitElement);
    this.context = new ContextConsumer(this.host as LitElement, { context: WeavyContext, subscribe: true });
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

    if (this.observer) {
      this.whenObserver = new Promise((r) => this.resolveObserver = r);
    }

    this.observer = new MutationObserver(queryClient, { ...options });
    this.observerSubscribe();
    this.resolveObserver?.(this.observer)

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

  async mutate(variables: TVariables, options?: MutateOptions<TData, TError, TVariables, TContext>) {
    const observer = await this.whenObserver;
    return observer.mutate(variables, options);
  }

  hostConnected() {
    this.observerSubscribe();
  }

  hostDisconnected() {
    // Clear the subscription when the host is disconnected
    this.observerUnsubscribe?.();
  }
}
