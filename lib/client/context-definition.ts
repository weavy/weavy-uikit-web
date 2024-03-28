import { createContext } from "@lit/context";
import { type WeavyContextType } from "./weavy-context";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";

export { type WeavyContextType } from "./weavy-context";
export const weavyContextDefinition = createContext<WeavyContextType>(Symbol.for("weavy-context"));

export function createWeavyContextProvider(host: HTMLElement, initialValue?: WeavyContextType) {
    return new ContextProvider(host, { context: weavyContextDefinition, initialValue });
}

/**
 * Register a context provider before any component is transformed.
 * We will populate it when the WeavyEnvironment is constructed unless a different host is selected,
 * which naturally takes care of transformation order.
 */
const globalContextProvider = createWeavyContextProvider(document.documentElement);

export { globalContextProvider };