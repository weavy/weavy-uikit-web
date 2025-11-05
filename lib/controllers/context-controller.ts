import { ReactiveController, ReactiveControllerHost } from "lit";

import { Context, ContextType } from "@lit/context";
import { ContextConsumer } from "../utils/context/controllers/context-consumer";
import { whenConnected } from "../utils/dom";
//import { whenParentsDefined } from "../utils/dom";

/**
 * Support controller to consume a context.
 * Can be used to bridge the context consumer to external frameworks such as React.
 */
export class ContextController<TContext extends Context<unknown, unknown>> implements ReactiveController {
  private host: ReactiveControllerHost;
  private resolveContext?: (value: ContextType<TContext> | PromiseLike<ContextType<TContext>>) => void;
  private resolveRef?: (
    value: (HTMLElement) | PromiseLike<HTMLElement>
  ) => void;

  private _ref?: HTMLElement;

  /**
   * The DOM connected element that can subscribe to a context
   */
  get ref() {
    return this._ref;
  }
  set ref(ref) {
    this._ref = ref;
    if (ref) {
      this.resolveRef?.(ref);
    }
  }

  /** 
   * Set the DOM connected element that can subscribe to a context.
   * Wrapper function for React linting compatibility. 
   */
  setRef(refElement?: HTMLElement) {
    this.ref = refElement;
  }

  /**
   * Promise that resolves when a ref element is set.
   * @resolves The ref element.
   */
  whenRef: Promise<HTMLElement> = new Promise((r) => (this.resolveRef = r));

  /**
   * The context consumer. Use `context.value` to get the value of the consumed context.
   */
  context?: ContextConsumer<TContext, ReactiveControllerHost & HTMLElement>;

  /**
   * Promise that resolves when the context is consumed.
   * @resolves The value of the consumed context.
   */
  whenContext?: Promise<ContextType<TContext>>;

  /**
   * @param host - The host element
   * @param context - The Context to use. Should be constructed using createContext().
   */
  constructor(host: ReactiveControllerHost, context: TContext, ref?: HTMLElement) {
    host.addController(this);
    this.host = host;
    this.setRef(ref);
    void this.setContext(context);
  }

  private async setContext(context: TContext) {
    this.whenContext = new Promise((r) => (this.resolveContext = r));
    const ref = await this.whenRef;
    //await whenParentsDefined(ref);
    this.context = new ContextConsumer(this.host as ReactiveControllerHost & HTMLElement, {
      context: context,
      subscribe: true,
      callback: (value, _dispose) => {
        this.resolveContext?.(value);
        this.host.requestUpdate();
      },
      ref: ref,
    });
    await whenConnected(ref);
    this.context.dispatchRequest();
  }

  hostUpdate(): void {
    if (this.context?.value) {
      this.resolveContext?.(this.context.value);
    }
  }
}
