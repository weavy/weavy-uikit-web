import { ContextEvent as ContextRequestEvent } from "@lit/context";
import { ValueNotifier } from "node_modules/@lit/context/lib/value-notifier.js";
import type { Context, ContextType } from "@lit/context";

declare global {
  interface HTMLElementEventMap {
    /**
     * A 'context-provider' event can be emitted by any element which hosts
     * a context provider to indicate it is available for use.
     */
    "context-provider": ContextProviderEvent<Context<unknown, unknown>>;
  }
}

export class ContextProviderEvent<C extends Context<unknown, unknown>> extends Event {
  readonly context: C;

  /**
   *
   * @param context the context which this provider can provide
   */
  constructor(context: C) {
    super("context-provider", { bubbles: true, composed: true });
    this.context = context;
  }
}

export interface Options<C extends Context<unknown, unknown>> {
  context: C;
  initialValue?: ContextType<C>;
}

/**
 * A ReactiveController which adds context provider behavior to a
 * custom element.
 *
 * This controller simply listens to the `context-request` event when
 * the host is connected to the DOM and registers the received callbacks
 * against its observable Context implementation.
 */
export class WyContextProvider<T extends Context<unknown, unknown>> extends ValueNotifier<ContextType<T>> {
  protected readonly host: HTMLElement;
  private readonly context: T;
  protected isAttached: boolean;

  constructor(host: HTMLElement, options: Options<T>);
  /** @deprecated Use new ContextProvider(host, options) */
  constructor(host: HTMLElement, context: T, initialValue?: ContextType<T>);
  constructor(host: HTMLElement, contextOrOptions: T | Options<T>, initialValue?: ContextType<T>) {
    super(
      (contextOrOptions as Options<T>).context !== undefined
        ? (contextOrOptions as Options<T>).initialValue
        : initialValue
    );
    this.host = host;
    if ((contextOrOptions as Options<T>).context !== undefined) {
      this.context = (contextOrOptions as Options<T>).context;
    } else {
      this.context = contextOrOptions as T;
    }

    this.isAttached = true;
    this.attachListeners();
    this.dispatchWhenConnected();
  }

  onContextRequest = (ev: ContextRequestEvent<Context<unknown, unknown>>): void => {
    // Only call the callback if the context matches.
    // Also, in case an element is a consumer AND a provider
    // of the same context, we want to avoid the element to self-register.
    // The check on composedPath (as opposed to ev.target) is to cover cases
    // where the consumer is in the shadowDom of the provider (in which case,
    // event.target === this.host because of event retargeting).
    const consumerHost = ev.composedPath()[0] as Element;
    if (ev.context !== this.context || consumerHost === this.host) {
      return;
    }
    ev.stopPropagation();
    this.addCallback(ev.callback, consumerHost, ev.subscribe);
  };

  /**
   * When we get a provider request event, that means a child of this element
   * has just woken up. If it's a provider of our context, then we may need to
   * re-parent our subscriptions, because is a more specific provider than us
   * for its subtree.
   */
  onProviderRequest = (ev: ContextProviderEvent<Context<unknown, unknown>>): void => {
    // Ignore events when the context doesn't match.
    // Also, in case an element is a consumer AND a provider
    // of the same context it shouldn't provide to itself.
    // We use composedPath (as opposed to ev.target) to cover cases
    // where the consumer is in the shadowDom of the provider (in which case,
    // event.target === this.host because of event retargeting).
    const childProviderHost = ev.composedPath()[0] as Element;
    if (ev.context !== this.context || childProviderHost === this.host) {
      return;
    }
    // Re-parent all of our subscriptions in case this new child provider
    // should take them over.
    const seen = new Set<unknown>();
    for (const [callback, { consumerHost }] of this.subscriptions) {
      // Prevent infinite loops in the case where a one host element
      // is providing the same context multiple times.
      //
      // While normally it's a no-op to attempt to re-parent a subscription
      // that already has its proper parent, in the case where there's more
      // than one ValueProvider for the same context on the same hostElement,
      // they will each call the consumer, and since they will each have their
      // own dispose function, a well behaved consumer will notice the change
      // in dispose function and call their old one.
      //
      // This will cause the subscriptions to thrash, but worse, without this
      // set check here, we can end up in an infinite loop, as we add and remove
      // the same subscriptions onto the end of the map over and over.
      if (seen.has(callback)) {
        continue;
      }
      seen.add(callback);
      consumerHost.dispatchEvent(new ContextRequestEvent(this.context, callback, true));
    }
    ev.stopPropagation();
  };

  private attachListeners() {
    this.host.addEventListener("context-request", this.onContextRequest);
    this.host.addEventListener("context-provider", this.onProviderRequest);
  }

  detachListeners() {
    this.isAttached = false;
    this.host.removeEventListener("context-request", this.onContextRequest);
    this.host.removeEventListener("context-provider", this.onProviderRequest);
  }

  dispatchWhenConnected(): void {
    if (this.isAttached) {
      if (this.host.isConnected) {
        // emit an event to signal a provider is available for this context
        this.host.dispatchEvent(new ContextProviderEvent(this.context));
      } else {
        requestAnimationFrame(this.dispatchWhenConnected);
      }
    }
  }
}
