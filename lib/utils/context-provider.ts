import { Context, ContextProvider, ContextType } from "@lit/context";
import { LitElement, ReactiveControllerHost } from "lit";
import { ContextProviderEvent, type Options } from "./context/controllers/context-provider";

type ReactiveElementHost = Partial<ReactiveControllerHost> & HTMLElement;

export class WyContextProvider<
  T extends Context<unknown, unknown>,
  HostElement extends ReactiveElementHost = ReactiveElementHost
> extends ContextProvider<T, HostElement> {
  private readonly _context: T;
  protected isAttached: boolean;
  
  constructor(host: HostElement, options: Options<T>);
  /** @deprecated Use new ContextProvider(host, options) */
  constructor(host: HostElement, context: T, initialValue?: ContextType<T>);
  constructor(
    host: HostElement,
    contextOrOptions:  T | Options<T>,
    initialValue?: ContextType<T>
  ) {
      if((contextOrOptions as Options<T>).context !== undefined) {
        super(host, contextOrOptions as Options<T>);
      } else {
        super(host, contextOrOptions as T, initialValue);
      }

      if ((contextOrOptions as Options<T>).context !== undefined) {
        this._context = (contextOrOptions as Options<T>).context;
      } else {
        this._context = contextOrOptions as T;
      }
      this.isAttached = true;

      if(!(this.host instanceof LitElement)) {
        this.dispatchWhenConnected();
      }
  }
  
  dispatchWhenConnected(): void {
    if (this.isAttached) {
      if (this.host.isConnected) {
        // emit an event to signal a provider is available for this context
        this.host.dispatchEvent(new ContextProviderEvent(this._context));
      } else {
        requestAnimationFrame(this.dispatchWhenConnected);
      }
    }
  }

  detachListeners() {
    this.isAttached = false;
    this.host.removeEventListener("context-request", this.onContextRequest);
    this.host.removeEventListener("context-provider", this.onProviderRequest);
  }
}
