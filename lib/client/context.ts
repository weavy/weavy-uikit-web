import { WeavyClient, WeavyType } from "./weavy";
import { Constructor } from "../types/generic.types";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { globalContextProvider, WeavyContext } from "../contexts/weavy-context";

export interface WeavyContextProviderProps {}

// WeavyQuery mixin/decorator
export const WeavyContextProviderMixin = <TBase extends Constructor<WeavyClient>>(Base: TBase) => {
  return class WeavyContextProvider extends Base implements WeavyContextProviderProps {
    // CONTEXT PROVIDER
    // SHOULD BE APPLIED LAST TO ENSURE EVERYTHING IS SET BEFORE CONTEXT GETS PROVIDED

    #hostContextProvider?: ContextProvider<typeof WeavyContext>;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args: any[]) {
      super(...args);

      // Context root
      if (this.host !== document.documentElement) {
        globalContextProvider?.detachListeners();
        this.#hostContextProvider = new ContextProvider(this.host, {
          context: WeavyContext,
          initialValue: this as unknown as WeavyType,
        });
      } else {
        globalContextProvider?.setValue(this as unknown as WeavyType);
      }
    }

    override destroy() {
      super.destroy();

      if (this.host !== document.documentElement) {
        this.#hostContextProvider?.detachListeners();
      } else {
        if (globalContextProvider?.value === (this as unknown as WeavyType)) {
          globalContextProvider?.setValue(undefined);
        }
      }
    }
  };
};
