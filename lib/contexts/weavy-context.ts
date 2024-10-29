import { createContext } from "@lit/context";
import { type WeavyType } from "../client/weavy";
import { WyContextProvider as ContextProvider } from "../utils/context-provider";
import { isDomAvailable, throwOnDomNotAvailable } from "../utils/dom";

export { type WeavyType } from "../client/weavy";
export const WeavyContext = createContext<WeavyType | undefined>(Symbol.for("weavy-client"));

export function createWeavyContextProvider(host: HTMLElement, initialValue?: WeavyType) {
    throwOnDomNotAvailable()
    return new ContextProvider(host, { context: WeavyContext, initialValue });
}

/**
 * Register a context provider before any component is transformed.
 * We will populate it when the WeavyClient is constructed unless a different host is selected,
 * which naturally takes care of transformation order.
 */
const globalContextProvider = isDomAvailable() ? createWeavyContextProvider(document.documentElement) : undefined;

export { globalContextProvider };