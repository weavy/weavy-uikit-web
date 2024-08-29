import { createContext } from "@lit/context";
import { type WeavyContextType } from "../client/weavy";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { isDomAvailable, throwOnDomNotAvailable } from "../utils/dom";

export { type WeavyContextType } from "../client/weavy";
export const weavyContextDefinition = createContext<WeavyContextType | undefined>(Symbol.for("weavy-context"));

export function createWeavyContextProvider(host: HTMLElement, initialValue?: WeavyContextType) {
    throwOnDomNotAvailable()
    return new ContextProvider(host, { context: weavyContextDefinition, initialValue });
}

/**
 * Register a context provider before any component is transformed.
 * We will populate it when the WeavyEnvironment is constructed unless a different host is selected,
 * which naturally takes care of transformation order.
 */
const globalContextProvider = isDomAvailable() ? createWeavyContextProvider(document.documentElement) : undefined;

export { globalContextProvider };